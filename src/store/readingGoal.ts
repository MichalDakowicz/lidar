import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { mmkvStorage } from '@/lib/mmkvStorage';
import { changeGoal, type GoalPeriod, type GoalScope } from '@/lib/weeklyGoal';

/**
 * Pages a week the streak asks for.
 *
 * 150 by default — about 20 minutes a night for most readers, which is a habit
 * rather than a challenge. A streak that is hard to keep is a streak people
 * stop looking at.
 *
 * Device-local (MMKV) rather than a column on the shared `user_settings` table:
 * Radar and Sonar share that row, and a goal is not worth an entry in the
 * three-app contract until something server-side needs to read it. If streak
 * notifications are ever added this moves, and `lib/streak.weekShortfall` is
 * already the shape that write would take.
 */
export const DEFAULT_WEEKLY_PAGES = 150;

/**
 * The goal is typed rather than picked off a shelf of five numbers, so the
 * bounds live here: one page a week is the smallest goal that means anything,
 * and 20 000 is past any human week — both exist to stop a stray keystroke
 * turning the streak into a number nobody can read.
 */
export const MIN_WEEKLY_PAGES = 1;
export const MAX_WEEKLY_PAGES = 20000;

export function clampWeeklyPages(pages: number): number {
  if (!Number.isFinite(pages)) return DEFAULT_WEEKLY_PAGES;
  return Math.min(MAX_WEEKLY_PAGES, Math.max(MIN_WEEKLY_PAGES, Math.round(pages)));
}

type ReadingGoalState = {
  /** The goal now. Every week from `history`'s last end onwards. */
  weeklyPages: number;
  /**
   * The goals before it, each with the Monday it stopped applying (lib/weeklyGoal).
   * Empty until someone changes the goal "from this week" — which is why a state
   * persisted before this field existed loads as one number for all of history,
   * exactly what it was.
   */
  history: GoalPeriod[];
  /** Change the goal, for the weeks from now on or for the whole history. */
  setGoal: (weeklyPages: number, scope: GoalScope) => void;
};

export const useReadingGoal = create<ReadingGoalState>()(
  persist(
    (set) => ({
      weeklyPages: DEFAULT_WEEKLY_PAGES,
      history: [],
      setGoal: (weeklyPages, scope) =>
        set((state) => changeGoal(state, clampWeeklyPages(weeklyPages), scope)),
    }),
    { name: 'reading-goal', storage: createJSONStorage(() => mmkvStorage), version: 1 },
  ),
);
