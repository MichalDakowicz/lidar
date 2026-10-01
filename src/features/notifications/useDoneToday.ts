import { useCallback, useMemo } from 'react';

import { useProgress } from '@/hooks/useProgress';
import { useReads } from '@/hooks/useReads';
import { dailyPages, dateKey } from '@/lib/streak';
import { useStreakEpoch } from '@/store/streakEpoch';

/**
 * Whether the reading nudge has already been answered on a given day: any pages
 * logged — bookmark moves and finished books alike, the same ledger the streak
 * and the calendar add up, including the streak reset.
 *
 * A function of the day rather than a flag for today, so the reminder queue can
 * be rebuilt on a later morning without this hook having re-rendered since.
 */
export function useDoneToday() {
  const { reads, loading: readsLoading, error: readsError } = useReads();
  const { progress, loading: progressLoading, error: progressError } = useProgress();
  const since = useStreakEpoch((state) => state.since);

  const daily = useMemo(() => dailyPages(reads, progress, since), [reads, progress, since]);
  const isDoneOn = useCallback((date: Date) => (daily[dateKey(date)] ?? 0) > 0, [daily]);

  // Planning against a ledger that has not arrived would queue today's reminder
  // for someone who read an hour ago, so the queue waits for both reads.
  const ready = !readsLoading && !progressLoading && !readsError && !progressError;

  return { ready, isDoneOn };
}
