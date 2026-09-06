import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { mmkvStorage } from '@/lib/mmkvStorage';
import type { BookmarkMode } from '@/lib/progress';

/**
 * Which number the reader types when they say what page they are on.
 *
 * `finished` — the last page they read. `next` — the one they will open on.
 * Both are how people actually keep a bookmark, and a book tracked one way one
 * week and the other the next produces a page count that is quietly wrong. The
 * page tracker asks once and remembers, because people are consistent about it:
 * after the first book it is one field and no decision.
 *
 * Device-local (MMKV), like the reading goal and the streak reset — it is how
 * one person reads a bookmark, not something the server has any use for.
 */
type BookmarkModeState = {
  mode: BookmarkMode;
  setMode: (mode: BookmarkMode) => void;
};

export const useBookmarkMode = create<BookmarkModeState>()(
  persist(
    (set) => ({
      mode: 'finished',
      setMode: (mode) => set({ mode }),
    }),
    { name: 'lidar.bookmarkMode', storage: createJSONStorage(() => mmkvStorage), version: 1 },
  ),
);
