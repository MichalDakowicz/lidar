import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { mmkvStorage } from '@/lib/mmkvStorage';

/**
 * The cut-off the reading streak and the calendar start counting from.
 *
 * A reset has to leave the read log alone: a book you finished is finished, its
 * pages are part of your year, and `books.last_read_at` still points at the day
 * it happened. What a reset actually means is "stop drawing the habit I had
 * before now" — so it is a date the two habit surfaces filter on, not a delete.
 * Nothing is destroyed and clearing the cut-off brings the old calendar back.
 *
 * Device-local (MMKV) for the same reason the weekly goal is: `user_settings`
 * is the row Radar and Sonar share, and a per-device preference is not worth an
 * entry in the three-app contract. The cost is that resetting on the phone
 * leaves the web build counting from wherever it was told to.
 */
type StreakEpochState = {
  /** ISO instant. Reads finished before it are ignored by the streak. */
  since: string | null;
  reset: (at?: Date) => void;
  clear: () => void;
};

export const useStreakEpoch = create<StreakEpochState>()(
  persist(
    (set) => ({
      since: null,
      reset: (at = new Date()) => set({ since: at.toISOString() }),
      clear: () => set({ since: null }),
    }),
    { name: 'lidar.streakEpoch', storage: createJSONStorage(() => mmkvStorage), version: 1 },
  ),
);
