import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { mmkvStorage } from '@/lib/mmkvStorage';

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
export const WEEKLY_PAGE_OPTIONS = [50, 100, 150, 250, 400];

type ReadingGoalState = {
  weeklyPages: number;
  setWeeklyPages: (weeklyPages: number) => void;
};

export const useReadingGoal = create<ReadingGoalState>()(
  persist(
    (set) => ({
      weeklyPages: DEFAULT_WEEKLY_PAGES,
      setWeeklyPages: (weeklyPages) => set({ weeklyPages }),
    }),
    { name: 'reading-goal', storage: createJSONStorage(() => mmkvStorage), version: 1 },
  ),
);
