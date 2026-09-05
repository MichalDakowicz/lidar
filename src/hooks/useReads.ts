import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';

import { useAuth } from '@/features/auth/AuthProvider';
import { booksQueryKey } from '@/hooks/useBooks';
import { normalizeRead, type ReadRow } from '@/lib/normalizeBook';
import { summarizeReads } from '@/lib/reads';
import { stripUndefined } from '@/lib/stripUndefined';
import { supabase } from '@/lib/supabase';
import type { Book, Read } from '@/types/book';

// The whole log, not a page of it: the library sorts by last read and the
// stats count reads per book, so a truncated log would quietly under-report
// both. One row per finished read is small — thousands are tens of kilobytes.
const READ_LIMIT = 5000;

function readsQueryKey(userId: string | undefined) {
  return ['reads', userId] as const;
}

async function fetchReads(userId: string): Promise<Read[]> {
  const { data, error } = await supabase
    .from('book_reads')
    .select('*')
    .eq('user_id', userId)
    .order('finished_at', { ascending: false })
    .limit(READ_LIMIT);
  if (error) throw error;
  return (data as ReadRow[]).map(normalizeRead);
}

/**
 * The read log and its two writes. Finishing a book writes two rows: the read
 * itself, and the mirror on the book (books.last_read_at) that a friend's
 * shelf reads without pulling anyone's history. Deleting one re-derives that
 * mirror from what is left, so removing today's entry puts the previous one
 * back.
 *
 * Finishing also clears the live bookmark (books.current_page): you are not
 * 300 pages into a book you have closed, and leaving the number behind would
 * draw a full progress bar on a book the shelf already calls finished.
 */
export function useReads() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = readsQueryKey(user?.id);

  const query = useQuery({
    queryKey,
    queryFn: () => fetchReads(user!.id),
    enabled: !!user,
  });

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`book_reads:${user.id}:${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'book_reads', filter: `user_id=eq.${user.id}` },
        () => queryClient.invalidateQueries({ queryKey }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient, queryKey]);

  // Memoized rather than `query.data ?? []` inline: a fresh array literal every
  // render would re-run every consumer's derivation over the whole log.
  const reads = useMemo(() => query.data ?? [], [query.data]);
  const summary = useMemo(() => summarizeReads(reads), [reads]);

  const logRead = async (book: Book, finishedAt: string = new Date().toISOString()) => {
    if (!user) return;

    const { error } = await supabase.from('book_reads').insert(
      stripUndefined({
        user_id: user.id,
        book_id: book.id,
        book_key: book.bookKey,
        title: book.title,
        authors: book.authors,
        cover_url: book.coverUrl,
        finished_at: finishedAt,
        // Snapshotted, so a re-read of a different edition still counts the
        // right number of pages toward the year's total.
        page_count: book.pageCount,
      }),
    );
    if (error) throw error;

    // Mirror, bookmark and status, in one write. Only move the mirror forward:
    // back-dating a read you forgot to log must not make an older one look
    // like the latest.
    const forward = !book.lastReadAt || Date.parse(finishedAt) > Date.parse(book.lastReadAt);
    const { error: mirrorError } = await supabase
      .from('books')
      .update(
        stripUndefined({
          last_read_at: forward ? finishedAt : undefined,
          current_page: null,
          progress_updated_at: null,
          // Only 'Reading' graduates. A wishlist book you borrowed and
          // finished is still not on your shelf.
          status: book.status === 'Reading' ? 'Library' : undefined,
        }),
      )
      .eq('id', book.id);
    if (mirrorError) console.error('Failed to update the book after a read', mirrorError);

    const { error: activityError } = await supabase.from('book_activity').insert({
      user_id: user.id,
      book_id: book.id,
      book_key: book.bookKey,
      book_title: book.title,
      type: 'finished_read',
      details: { finishedAt, pageCount: book.pageCount },
    });
    if (activityError) console.error('Failed to log read activity', activityError);

    queryClient.invalidateQueries({ queryKey });
    queryClient.invalidateQueries({ queryKey: booksQueryKey(user.id) });
  };

  const removeRead = async (readId: string) => {
    if (!user) return;

    const read = reads.find((entry) => entry.id === readId);
    const { error } = await supabase.from('book_reads').delete().eq('id', readId);
    if (error) throw error;

    // Re-derive the mirror from the log rather than trusting the local cache:
    // this is the one write where being wrong leaves a visible lie on the card.
    if (read?.bookId) {
      const { data, error: latestError } = await supabase
        .from('book_reads')
        .select('finished_at')
        .eq('book_id', read.bookId)
        .order('finished_at', { ascending: false })
        .limit(1);
      if (latestError) console.error('Failed to re-read the last finish date', latestError);
      const latest = (data as { finished_at: string }[] | null)?.[0]?.finished_at ?? null;
      const { error: mirrorError } = await supabase
        .from('books')
        .update({ last_read_at: latest })
        .eq('id', read.bookId);
      if (mirrorError) console.error('Failed to update last read', mirrorError);
    }

    queryClient.invalidateQueries({ queryKey });
    queryClient.invalidateQueries({ queryKey: booksQueryKey(user.id) });
  };

  return {
    reads,
    summary,
    loading: query.isLoading,
    error: query.error,
    logRead,
    removeRead,
  };
}

/** Read-only read log for someone else's shelf (RLS decides if it is visible). */
export function usePublicReads(userId: string | undefined, limit = 200) {
  const query = useQuery({
    queryKey: ['publicReads', userId, limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('book_reads')
        .select('*')
        .eq('user_id', userId!)
        .order('finished_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data as ReadRow[]).map(normalizeRead);
    },
    enabled: !!userId,
  });
  return { reads: query.data ?? [], loading: query.isLoading };
}
