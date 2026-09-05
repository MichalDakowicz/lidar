import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { useAuth } from '@/features/auth/AuthProvider';
import { bookKey } from '@/lib/bookKey';
import { normalizeBook, toBookRow, type BookRow } from '@/lib/normalizeBook';
import { stripUndefined } from '@/lib/stripUndefined';
import { supabase } from '@/lib/supabase';
import type { Book, BookActivityType } from '@/types/book';

export function booksQueryKey(userId: string | undefined) {
  return ['books', userId] as const;
}

async function fetchBooks(userId: string): Promise<Book[]> {
  const { data, error } = await supabase
    .from('books')
    .select('*')
    .eq('user_id', userId)
    .order('added_at', { ascending: false });
  if (error) throw error;
  return (data as BookRow[]).map(normalizeBook);
}

/**
 * The activity log is written here, beside the mutation, for the same reason
 * Radar's is: an event that has to be logged by the caller is an event that
 * eventually is not.
 */
async function logActivity(
  userId: string,
  book: { id: string | null; bookKey: string | null; title: string },
  type: BookActivityType,
  details: Record<string, unknown> = {},
) {
  const { error } = await supabase.from('book_activity').insert(
    stripUndefined({
      user_id: userId,
      book_id: book.id,
      book_key: book.bookKey,
      book_title: book.title,
      type,
      details,
    }),
  );
  // A feed row failing must never fail the write the user asked for.
  if (error) console.error('Failed to log book activity', error);
}

export type NewBook = Partial<Book> & { title: string };

/**
 * The library, plus its write helpers. Realtime replaces the legacy
 * Firebase `onValue` subscription: any change to this user's rows invalidates
 * the cached list.
 *
 * Channel name carries a random suffix — React's dev-mode double-invoke can run
 * this effect twice before the first channel's removeChannel() finishes, and
 * supabase-js caches channels by name, so reusing an already-subscribed channel
 * throws on `.on()`.
 */
export function useBooks() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = booksQueryKey(user?.id);

  const query = useQuery({
    queryKey,
    queryFn: () => fetchBooks(user!.id),
    enabled: !!user,
  });

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`books:${user.id}:${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'books', filter: `user_id=eq.${user.id}` },
        () => queryClient.invalidateQueries({ queryKey }),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient, queryKey]);

  const addBook = async (book: NewBook): Promise<Book | null> => {
    if (!user) return null;

    const key =
      book.bookKey ?? bookKey({ googleId: book.googleId ?? null, title: book.title, authors: book.authors });
    const row = stripUndefined({
      ...toBookRow({ ...book, bookKey: key }),
      user_id: user.id,
      title: book.title,
    });

    const { data, error } = await supabase.from('books').insert(row).select('*').single();
    if (error) throw error;
    const inserted = normalizeBook(data as BookRow);

    await logActivity(user.id, { id: inserted.id, bookKey: key, title: inserted.title }, 'added', {
      status: inserted.status,
      format: inserted.formats[0],
      formats: inserted.formats,
    });
    queryClient.invalidateQueries({ queryKey });
    return inserted;
  };

  const updateBook = async (bookId: string, updates: Partial<Book>, options: { silent?: boolean } = {}) => {
    if (!user) return;

    const current = query.data?.find((book) => book.id === bookId);
    const row = stripUndefined(toBookRow({ ...updates, updatedAt: new Date().toISOString() }));

    const { error } = await supabase.from('books').update(row).eq('id', bookId);
    if (error) throw error;

    // `silent` is for writes the user did not ask for as an event — a drag to
    // reorder, the last-played mirror — which would otherwise fill the feed.
    if (current && !options.silent) {
      const target = { id: bookId, bookKey: current.bookKey, title: current.title };
      if (updates.status && updates.status !== current.status) {
        await logActivity(user.id, target, 'status_changed', {
          oldStatus: current.status,
          newStatus: updates.status,
        });
      } else if (updates.formats) {
        const gained = updates.formats.filter((format) => !current.formats.includes(format));
        if (gained.length > 0) await logActivity(user.id, target, 'format_added', { format: gained[0], formats: gained });
        else await logActivity(user.id, target, 'updated', {});
      } else if (Object.keys(updates).length > 0) {
        await logActivity(user.id, target, 'updated', {});
      }
    }

    queryClient.invalidateQueries({ queryKey });
  };

  const removeBook = async (bookId: string) => {
    if (!user) return;

    const book = query.data?.find((entry) => entry.id === bookId);
    const { error } = await supabase.from('books').delete().eq('id', bookId);
    if (error) throw error;

    if (book) {
      // The book row is gone, so book_id must be null or the activity FK
      // rejects the insert. The rating row is deliberately left alone: it keys
      // off the release, not the shelf, so a re-add finds its score again.
      await logActivity(user.id, { id: null, bookKey: book.bookKey, title: book.title }, 'removed', {});
    }
    queryClient.invalidateQueries({ queryKey });
  };

  return {
    books: query.data ?? [],
    loading: query.isLoading,
    error: query.error,
    addBook,
    updateBook,
    removeBook,
    refetch: query.refetch,
  };
}
