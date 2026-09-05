import { useMemo } from 'react';

import { personalScore } from '@/lib/personalScore';
import { ratingDistribution } from '@/lib/ratingDistribution';
import { listeningStreak, readsPerDay } from '@/lib/reads';
import { computeStats, type LibraryStats } from '@/lib/stats';
import { periodDays, periodStart, scopeReadsToPeriod, type StatsPeriodId } from '@/lib/statsPeriod';
import type { Book, BookRating, Read } from '@/types/book';
import type { RatingDistributionResult } from '@/lib/ratingDistribution';

export type StatsBundle = {
  stats: LibraryStats;
  distribution: RatingDistributionResult;
  perDay: { date: string; count: number }[];
  streak: number;
  /** Reads inside the window — the headline "plays" number. */
  periodReads: number;
};

/**
 * Everything the Stats screen reads, in one memo chain.
 *
 * The period scopes the read log only. The library is a shelf, not a stream
 * of events: narrowing "records owned" by when a sleeve was bought would answer
 * a question nobody asked, and would make the format split and total value
 * jump around as the window changes.
 */
export function useStats({
  books,
  reads,
  ratings,
  period,
}: {
  books: Book[];
  reads: Read[];
  ratings: BookRating[];
  period: StatsPeriodId;
}): StatsBundle {
  const scopedReads = useMemo(() => scopeReadsToPeriod(reads, periodStart(period)), [reads, period]);

  const stats = useMemo(
    () => computeStats({ books, reads: scopedReads, ratings, scoreOf: (rating) => personalScore(rating.ratings) }),
    [books, scopedReads, ratings],
  );

  const distribution = useMemo(() => ratingDistribution(ratings), [ratings]);

  // The strip is capped at 90 columns: a year of days is unreadable at phone
  // width, and "this year" is the only period that can exceed it.
  const perDay = useMemo(() => readsPerDay(scopedReads, Math.min(periodDays(period), 90)), [scopedReads, period]);

  // The streak reads the whole log, never the window: a run of listening days
  // does not restart because you changed the period picker.
  const streak = useMemo(() => listeningStreak(reads), [reads]);

  return { stats, distribution, perDay, streak, periodReads: scopedReads.length };
}
