import { useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/features/auth/AuthProvider';
import { booksQueryKey, dropBook, patchBook, refreshBook } from '@/hooks/booksCache';
import { bookKey } from '@/lib/bookKey';
import { normalizeBook, toBookRow, type BookRow } from '@/lib/normalizeBook';
import { stripUndefined } from '@/lib/stripUndefined';
import { supabase } from '@/lib/supabase';
import type { Book, BookActivityType } from '@/types/book';

// Realtime (useLibraryRealtime) and our own writes both patch single rows into this
// list, so a full re-read is only the catch-up after the app was away - the socket
// is not delivering while it is backgrounded.
const LIBRARY_STALE_MS = 5 * 60 * 1000;

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
 * The library, plus its write helpers. A write patches the one row it touched
 * into the cached list (hooks/booksCache) rather than refetching the shelf.
 */
export function useBooks() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = booksQueryKey(user?.id);

  const query = useQuery({
    queryKey,
    queryFn: () => fetchBooks(user!.id),
    enabled: !!user,
    staleTime: LIBRARY_STALE_MS,
  });

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
    });
    patchBook(queryClient, user.id, inserted);
    return inserted;
  };

  const updateBook = async (bookId: string, updates: Partial<Book>, options: { silent?: boolean } = {}) => {
    if (!user) return;

    const current = query.data?.find((book) => book.id === bookId);
    const row = stripUndefined(toBookRow({ ...updates, updatedAt: new Date().toISOString() }));

    const { error } = await supabase.from('books').update(row).eq('id', bookId);
    if (error) throw error;

    // `silent` is for writes the user did not ask for as an event — a drag to
    // reorder, the last-read mirror — which would otherwise fill the feed.
    if (current && !options.silent) {
      const target = { id: bookId, bookKey: current.bookKey, title: current.title };
      if (updates.status && updates.status !== current.status) {
        await logActivity(user.id, target, 'status_changed', {
          oldStatus: current.status,
          newStatus: updates.status,
        });
      } else if (Object.keys(updates).length > 0) {
        await logActivity(user.id, target, 'updated', {});
      }
    }

    void refreshBook(queryClient, user.id, bookId);
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
    dropBook(queryClient, user.id, bookId);
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
