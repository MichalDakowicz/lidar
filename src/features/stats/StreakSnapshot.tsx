import { useEffect } from 'react';

import { useStats } from '@/features/stats/useStats';
import { useBookRatings } from '@/hooks/useBookRatings';
import { useBooks } from '@/hooks/useBooks';
import { useProgress } from '@/hooks/useProgress';
import { useReads } from '@/hooks/useReads';
import { useUserSettings } from '@/hooks/useUserSettings';
import { shouldPublishStreak } from '@/lib/streakSnapshot';
import { useReadingGoal } from '@/store/readingGoal';
import { useStreakEpoch } from '@/store/streakEpoch';

/**
 * Publishes the reading streak to `user_settings.lidar_streak`, so Pulsar's
 * cross-app strip can show the real number instead of guessing at it.
 *
 * Renders nothing. Mounted from the tabs layout, which is behind the signed-in
 * redirect and already loads the shelf — so this is the owner's own streak by
 * construction. That matters: `useStats` is also what a friend's public shelf
 * renders, and publishing from there would stamp somebody else's streak onto
 * this account.
 *
 * The maths is not repeated here. This is the same `useStats` the Stats screen
 * reads, against the same goal and the same reset epoch, so the number Pulsar
 * shows is the number on the page.
 */
export function StreakSnapshot() {
  const { books, loading: booksLoading } = useBooks();
  const { reads, loading: readsLoading } = useReads();
  const { progress, loading: progressLoading } = useProgress();
  const { ratings } = useBookRatings();
  const { settings, loading: settingsLoading, updateSettings } = useUserSettings();
  const weeklyGoal = useReadingGoal((s) => s.weeklyPages);
  const streakSince = useStreakEpoch((s) => s.since);

  const { streak } = useStats({
    books,
    reads,
    ratings,
    progress,
    // The streak ignores the period picker (see useStats), so the window here
    // is irrelevant to the published figure — 'all' just says that out loud.
    period: 'all',
    weeklyGoal,
    streakSince,
  });

  const loading = booksLoading || readsLoading || progressLoading || settingsLoading;

  useEffect(() => {
    // An empty ledger computes a streak of zero. Publishing that over a real one
    // before the first fetch lands would retract a streak that is still running.
    if (loading) return;
    if (!shouldPublishStreak(streak, settings)) return;
    void updateSettings({ lidarStreak: streak, lidarStreakUpdatedAt: new Date().toISOString() });
  }, [loading, streak, settings, updateSettings]);

  return null;
}
