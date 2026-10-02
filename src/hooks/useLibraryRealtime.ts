import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { useAuth } from '@/features/auth/AuthProvider';
import { booksQueryKey, dropBook, refreshBook } from '@/hooks/booksCache';
import { ratingsQueryKey } from '@/hooks/useBookRatings';
import { progressQueryKey } from '@/hooks/useProgress';
import { readsQueryKey } from '@/hooks/useReads';
import { supabase } from '@/lib/supabase';

/**
 * The one realtime channel for the library, mounted from the root layout. It used
 * to live inside useBooks, useReads and useProgress, which meant a channel per
 * mounted screen - and every one refetched its whole table for each event.
 *
 * A book event patches the row it names (Postgres only puts the primary key in a
 * DELETE's `old` record, which is all that is needed to drop it). The read log, the
 * page ledger and the ratings are a few small columns a row, so they simply refetch.
 */
export function useLibraryRealtime() {
  const { user } = useAuth();
  const uid = user?.id;
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!uid) return;
    const filter = `user_id=eq.${uid}`;
    // Random suffix per the dev-mode double mount note: supabase-js caches
    // channels by name and a re-subscribed one throws on `.on()`.
    const channel = supabase
      .channel(`library:${uid}:${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'books', filter }, (payload) => {
        const row = (payload.eventType === 'DELETE' ? payload.old : payload.new) as { id?: string };
        if (!row?.id) {
          queryClient.invalidateQueries({ queryKey: booksQueryKey(uid) });
        } else if (payload.eventType === 'DELETE') {
          dropBook(queryClient, uid, row.id);
        } else {
          void refreshBook(queryClient, uid, row.id);
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'book_reads', filter }, () =>
        queryClient.invalidateQueries({ queryKey: readsQueryKey(uid) }),
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'book_progress', filter }, () =>
        queryClient.invalidateQueries({ queryKey: progressQueryKey(uid) }),
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'book_ratings', filter }, () =>
        queryClient.invalidateQueries({ queryKey: ratingsQueryKey(uid) }),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [uid, queryClient]);
}
