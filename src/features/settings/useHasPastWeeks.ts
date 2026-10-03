import { useMemo } from 'react';

import { useProgress } from '@/hooks/useProgress';
import { useReads } from '@/hooks/useReads';
import { dailyPages } from '@/lib/streak';
import { hasPastWeeks } from '@/lib/weeklyGoal';
import { useStreakEpoch } from '@/store/streakEpoch';

/**
 * Whether the reader has any reading behind this week to rewrite — counted the
 * way the streak counts it, so a streak reset (which hides the past from the
 * habit surfaces) also hides it from the question.
 *
 * While the ledger is still arriving the answer is unknown, and a goal change
 * made in that window is asked about: the harmless wrong guess.
 */
export function useHasPastWeeks(): boolean {
  const { reads, loading: readsLoading } = useReads();
  const { progress, loading: progressLoading } = useProgress();
  const since = useStreakEpoch((state) => state.since);

  const daily = useMemo(() => dailyPages(reads, progress, since), [reads, progress, since]);
  return readsLoading || progressLoading || hasPastWeeks(daily);
}
