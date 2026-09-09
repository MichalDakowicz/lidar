import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';

import { useAuth } from '@/features/auth/AuthProvider';
import { booksQueryKey } from '@/hooks/useBooks';
import { progressQueryKey } from '@/hooks/useProgress';
import { normalizeRead, type ReadRow } from '@/lib/normalizeBook';
import { countablePages } from '@/lib/pages';
import { closingMove } from '@/lib/progress';
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
 * The read log and its writes. Finishing a book writes the read itself, the
 * closing row of the page ledger (public.book_progress — the pages between the
 * bookmark and the last page), and the mirror on the book
 * (books.last_read_at) that a friend's shelf reads without pulling anyone's
 * history. Deleting a read re-derives that mirror from what is left, so
 * removing today's entry puts the previous one back, and takes the ledger row
 * it wrote with it.
 *
 * Finishing also parks the live bookmark (books.current_page) on the last page
 * rather than clearing it: a finished book is a book you read all of, and the
 * full progress bar is the honest picture. Reset on the progress panel is what
 * empties it, and that is the gesture that means "I am reading this again".
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

    const { data: inserted, error } = await supabase
      .from('book_reads')
      .insert(
        stripUndefined({
          user_id: user.id,
          book_id: book.id,
          book_key: book.bookKey,
          title: book.title,
          authors: book.authors,
          cover_url: book.coverUrl,
          finished_at: finishedAt,
          // Snapshotted, so a re-read of a different edition still counts the
          // right number of pages toward the year's total — and snapshotted as
          // *countable* pages, past the front matter, because that is the number
          // the streak and the calendar add up (lib/pages).
          page_count: countablePages(book),
        }),
      )
      .select('id')
      .single();
    if (error) throw error;

    // The closing ledger row: whatever was left between the bookmark and the
    // last page. A book tracked page by page then finished must not count its
    // whole length twice, and a book finished in one sitting must not count
    // none at all — lib/streak prefers the ledger wherever it exists, so the
    // pages have to land here (lib/progress.closingMove).
    const closing = closingMove(book);
    const readId = (inserted as { id: string } | null)?.id ?? null;
    if (closing.pages > 0) {
      const { error: ledgerError } = await supabase.from('book_progress').insert(
        stripUndefined({
          user_id: user.id,
          book_id: book.id,
          book_key: book.bookKey,
          read_id: readId,
          page: closing.page,
          pages_delta: closing.pages,
          recorded_at: finishedAt,
        }),
      );
      if (ledgerError) console.error('Failed to close the page ledger for this read', ledgerError);
    }

    // Mirror, bookmark and status, in one write. Only move the mirror forward:
    // back-dating a read you forgot to log must not make an older one look
    // like the latest.
    const forward = !book.lastReadAt || Date.parse(finishedAt) > Date.parse(book.lastReadAt);
    const { error: mirrorError } = await supabase
      .from('books')
      .update(
        stripUndefined({
          last_read_at: forward ? finishedAt : undefined,
          // Parked on the last page, so the panel reads 100% and Reset has
          // something to clear when the book comes round again. An edition with
          // no page count has no last page, so it keeps whatever it had.
          current_page: book.pageCount ?? undefined,
          progress_updated_at: book.pageCount ? finishedAt : undefined,
          // Finishing it is what makes it read, whatever it was before — a
          // readlist book you sat down with in one evening included. Only a
          // row already marked Read needs no write.
          status: book.status === 'Read' ? undefined : 'Read',
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
      details: { finishedAt, pageCount: countablePages(book) },
    });
    if (activityError) console.error('Failed to log read activity', activityError);

    queryClient.invalidateQueries({ queryKey });
    queryClient.invalidateQueries({ queryKey: booksQueryKey(user.id) });
    queryClient.invalidateQueries({ queryKey: progressQueryKey(user.id) });
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

    // The closing ledger row is gone with it — book_progress.read_id cascades —
    // so the week that read belonged to loses its pages back.
    queryClient.invalidateQueries({ queryKey });
    queryClient.invalidateQueries({ queryKey: booksQueryKey(user.id) });
    queryClient.invalidateQueries({ queryKey: progressQueryKey(user.id) });
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
