import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';

import { isActivityInsert, mergeRecent } from '@/lib/recentFeed';
import { supabase } from '@/lib/supabase';
import { isFeedWorthy } from '@/lib/socialFeed';
import type { BookActivityEvent, BookActivityType } from '@/types/book';

type ActivityRow = {
  id: string;
  user_id: string;
  book_id: string | null;
  book_key: string | null;
  book_title: string;
  type: BookActivityType;
  details: Record<string, unknown> | null;
  created_at: string;
};

function normalizeActivity(row: ActivityRow): BookActivityEvent {
  return {
    id: row.id,
    userId: row.user_id,
    bookId: row.book_id,
    bookKey: row.book_key,
    bookTitle: row.book_title,
    type: row.type,
    details: row.details ?? {},
    createdAt: row.created_at,
  };
}

const PAGE = 120;

/**
 * The feed: activity from a set of people (your friends, and you).
 *
 * One `in` query rather than one per friend — RLS already filters out anyone
 * whose shelf you may not see, so an author you cannot read simply contributes
 * no rows instead of erroring.
 *
 * Realtime is subscribed without a filter: `postgres_changes` filters take one
 * column comparison, and there is no way to say "user_id in (…)". Only inserts by
 * selected authors affect this page. Complete rows patch the cached page directly;
 * cold, incomplete or in-flight data uses the normal read.
 */
export function useFriendActivity(authorIds: string[], selfId: string | undefined) {
  const queryClient = useQueryClient();
  const ids = useMemo(() => [...new Set(authorIds.filter(Boolean))].sort(), [authorIds]);
  const queryKey = useMemo(() => ['bookActivity', ids.join(',')] as const, [ids]);

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('book_activity')
        .select('id, user_id, book_id, book_key, book_title, type, details, created_at')
        .in('user_id', ids)
        .order('created_at', { ascending: false })
        .limit(PAGE);
      if (error) throw error;
      return (data as ActivityRow[]).map(normalizeActivity);
    },
    enabled: ids.length > 0,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (ids.length === 0) return;
    const channel = supabase
      .channel(`book_activity:feed:${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'book_activity' }, (payload) => {
        const row = payload.new;
        // Other public authors must not trigger a download of our whole page.
        if (typeof row.user_id === 'string' && !ids.includes(row.user_id)) return;
        // A cold or in-flight read remains authoritative, including privacy checks.
        const snapshot = queryClient.getQueryState(queryKey);
        if (!isActivityInsert(row, 'book') || !queryClient.getQueryData(queryKey) ||
            snapshot?.fetchStatus === 'fetching') {
          void queryClient.invalidateQueries({ queryKey });
          return;
        }
        const event = normalizeActivity(row as ActivityRow);
        // Realtime must not postpone the next authoritative catch-up read.
        queryClient.setQueryData<BookActivityEvent[]>(queryKey,
          (cached) => cached ? mergeRecent(cached, event, PAGE) : cached,
          { updatedAt: snapshot?.dataUpdatedAt });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [ids, queryClient, queryKey]);

  const events = useMemo(() => (query.data ?? []).filter(isFeedWorthy), [query.data]);

  // Your own rows are fetched alongside your friends' — one query either way —
  // but the default view is about them, so the feed keeps yours out until you
  // tap yourself in the rail.
  const friendEvents = useMemo(() => events.filter((event) => event.userId !== selfId), [events, selfId]);

  return {
    events,
    friendEvents,
    loading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
