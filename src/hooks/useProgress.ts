import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';

import { useAuth } from '@/features/auth/AuthProvider';
import { booksQueryKey } from '@/hooks/useBooks';
import { normalizeProgress, type ProgressRow } from '@/lib/normalizeBook';
import { stripUndefined } from '@/lib/stripUndefined';
import { supabase } from '@/lib/supabase';
import type { Book, Progress } from '@/types/book';

// The whole ledger, for the same reason the read log is fetched whole: the
// streak walks back day by day and the calendar draws six months, so a
// truncated ledger would quietly shorten both. A row is five columns.
const PROGRESS_LIMIT = 5000;

export function progressQueryKey(userId: string | undefined) {
  return ['bookProgress', userId] as const;
}

async function fetchProgress(userId: string): Promise<Progress[]> {
  const { data, error } = await supabase
    .from('book_progress')
    .select('*')
    .eq('user_id', userId)
    .order('recorded_at', { ascending: false })
    .limit(PROGRESS_LIMIT);
  if (error) throw error;
  return (data as ProgressRow[]).map(normalizeProgress);
}

/**
 * The page ledger and its one write.
 *
 * `books.current_page` is the live bookmark and this is its history, exactly as
 * `books.last_read_at` mirrors the read log. Every page number the streak and
 * the calendar add up comes from here: without it a reader 300 pages into a
 * 900-page novel has read every night for a month and contributed nothing to a
 * single day, which is the bug this table exists to fix.
 *
 * The bookmark write itself stays in useBookDetail — one place moves the
 * bookmark, and it records the move here in the same call.
 */
export function useProgress() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = progressQueryKey(user?.id);

  const query = useQuery({
    queryKey,
    queryFn: () => fetchProgress(user!.id),
    enabled: !!user,
  });

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`book_progress:${user.id}:${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'book_progress', filter: `user_id=eq.${user.id}` },
        () => queryClient.invalidateQueries({ queryKey }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient, queryKey]);

  const entries = useMemo(() => query.data ?? [], [query.data]);

  /**
   * Record one move. `pages` is what the move was worth — zero for a bookmark
   * corrected backwards, which is written anyway so the history says what
   * happened rather than silently rewriting itself.
   */
  const logProgress = async (
    book: Pick<Book, 'id' | 'bookKey'>,
    move: { page: number | null; pages: number; readId?: string | null; recordedAt?: string },
  ) => {
    if (!user) return;

    const { error } = await supabase.from('book_progress').insert(
      stripUndefined({
        user_id: user.id,
        book_id: book.id,
        book_key: book.bookKey,
        read_id: move.readId ?? undefined,
        page: move.page,
        pages_delta: Math.max(0, Math.round(move.pages)),
        recorded_at: move.recordedAt,
      }),
    );
    // A ledger row failing must not fail the bookmark the user asked to move —
    // the number on the shelf is still right, only the streak misses a day.
    if (error) {
      console.error('Failed to record reading progress', error);
      return;
    }

    queryClient.invalidateQueries({ queryKey });
    queryClient.invalidateQueries({ queryKey: booksQueryKey(user.id) });
  };

  return { progress: entries, loading: query.isLoading, error: query.error, logProgress };
}

/** Read-only ledger for someone else's shelf (RLS decides if it is visible). */
export function usePublicProgress(userId: string | undefined, limit = 2000) {
  const query = useQuery({
    queryKey: ['publicBookProgress', userId, limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('book_progress')
        .select('*')
        .eq('user_id', userId!)
        .order('recorded_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data as ProgressRow[]).map(normalizeProgress);
    },
    enabled: !!userId,
  });
  return { progress: query.data ?? [], loading: query.isLoading };
}
