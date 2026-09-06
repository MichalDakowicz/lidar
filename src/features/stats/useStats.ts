import { useMemo } from 'react';

import { personalScore } from '@/lib/personalScore';
import { ratingDistribution, type RatingDistributionResult } from '@/lib/ratingDistribution';
import { computeStats, type LibraryStats } from '@/lib/stats';
import { periodStart, scopeReadsToPeriod, type StatsPeriodId } from '@/lib/statsPeriod';
import { currentStreak, dailyPages, longestStreak, weekShortfall } from '@/lib/streak';
import type { Book, BookRating, Progress, Read } from '@/types/book';

/** Stable identity, so a caller with no ledger does not re-derive every render. */
const EMPTY_PROGRESS: Progress[] = [];

export type StatsBundle = {
  stats: LibraryStats;
  distribution: RatingDistributionResult;
  /** `YYYY-MM-DD` -> pages, the calendar's and the streak's shared input. */
  dailyPages: Record<string, number>;
  streak: number;
  longestStreak: number;
  /** Pages still owed this week to keep the streak. 0 means safe. */
  weekNeeded: number;
  weekPages: number;
  /** Reads inside the window — the headline "finished" number. */
  periodReads: number;
};

/**
 * Everything the Stats screen reads, in one memo chain.
 *
 * The period scopes the read log only. The shelf is a shelf, not a stream of
 * events: narrowing "books on the shelf" by when each was added would answer a
 * question nobody asked, and would make the author and genre splits jump around
 * as the window changes.
 */
export function useStats({
  books,
  reads,
  ratings,
  progress = EMPTY_PROGRESS,
  period,
  weeklyGoal,
  streakSince = null,
}: {
  books: Book[];
  reads: Read[];
  ratings: BookRating[];
  /** The page ledger — every bookmark move, with the day it happened on. */
  progress?: Progress[];
  period: StatsPeriodId;
  weeklyGoal: number;
  /** Streak reset (store/streakEpoch): earlier reads stay, the habit restarts. */
  streakSince?: string | null;
}): StatsBundle {
  const scopedReads = useMemo(() => scopeReadsToPeriod(reads, periodStart(period)), [reads, period]);

  const stats = useMemo(
    () => computeStats({ books, reads: scopedReads, ratings, scoreOf: (rating) => personalScore(rating.ratings) }),
    [books, scopedReads, ratings],
  );

  const distribution = useMemo(() => ratingDistribution(ratings), [ratings]);

  // The streak reads the whole log, never the window: a run of reading weeks
  // does not restart because you changed the period picker.
  //
  // Both sources go in: the ledger, which is where nightly reading lands, and
  // the read log, which covers a book that was only ever marked finished.
  // dailyPages settles which of the two owns each book so nothing is counted
  // twice.
  const daily = useMemo(() => dailyPages(reads, progress, streakSince), [reads, progress, streakSince]);
  const streak = useMemo(() => currentStreak(daily, weeklyGoal), [daily, weeklyGoal]);
  const longest = useMemo(() => longestStreak(daily, weeklyGoal), [daily, weeklyGoal]);
  const week = useMemo(() => weekShortfall(daily, weeklyGoal), [daily, weeklyGoal]);

  return {
    stats,
    distribution,
    dailyPages: daily,
    streak,
    longestStreak: longest,
    weekNeeded: week.needed,
    weekPages: week.read,
    periodReads: scopedReads.length,
  };
}
