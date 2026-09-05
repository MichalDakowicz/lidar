import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { GridSize } from '@/components/media/BookGrid';
import { SORT_DEFAULT_DIR, type SortBy, type SortDir } from '@/lib/librarySort';
import type { GroupBy } from '@/lib/libraryFacets';
import { mmkvStorage } from '@/lib/mmkvStorage';
import type { BookStatus } from '@/types/book';

// Durable library prefs: view mode, grid size, group-by, filters and sort
// are how you like to look at your shelf, so they survive a restart. Search
// text and scroll position stay remount-scoped and are never persisted here.
export type ViewMode = 'grid' | 'list';
export type StatusFilter = BookStatus | 'all';
export type { GridSize, GroupBy, SortBy, SortDir };

type LibraryPrefsState = {
  viewMode: ViewMode;
  gridSize: GridSize;
  groupBy: GroupBy;
  sortBy: SortBy;
  sortDir: SortDir;
  statusFilter: StatusFilter;
  selectedAuthors: string[];
  selectedGenres: string[];
  selectedYears: string[];
  readlistCollapsed: boolean;
  setViewMode: (viewMode: ViewMode) => void;
  setGridSize: (gridSize: GridSize) => void;
  setGroupBy: (groupBy: GroupBy) => void;
  setSortBy: (sortBy: SortBy) => void;
  toggleSortDir: () => void;
  setStatusFilter: (statusFilter: StatusFilter) => void;
  toggleAuthor: (authors: string) => void;
  toggleGenre: (genre: string) => void;
  toggleYear: (year: string) => void;
  toggleReadlistCollapsed: () => void;
  resetFilters: () => void;
};

/** Status filters that survive the 0.1 -> 0.2 prefs migration. */
const RETAINED_STATUS_FILTERS = new Set(['all', 'Readlist', 'Reading', 'Read', 'Did not finish']);

function toggleIn(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((entry) => entry !== value) : [...list, value];
}

export const useLibraryPrefs = create<LibraryPrefsState>()(
  persist(
    (set) => ({
      viewMode: 'grid',
      gridSize: 'normal',
      groupBy: 'none',
      // Shelf order is the default because the legacy app's default was its
      // drag-to-reorder order, and an existing library must open looking the
      // way it was left.
      sortBy: 'custom',
      sortDir: SORT_DEFAULT_DIR.custom,
      statusFilter: 'all',
      selectedAuthors: [],
      selectedGenres: [],
      selectedYears: [],
      readlistCollapsed: false,
      setViewMode: (viewMode) => set({ viewMode }),
      setGridSize: (gridSize) => set({ gridSize }),
      setGroupBy: (groupBy) => set({ groupBy }),
      // Picking a sort resets direction to that sort's natural one (newest,
      // highest, most recently read first); the arrow flips it from there.
      setSortBy: (sortBy) => set({ sortBy, sortDir: SORT_DEFAULT_DIR[sortBy] }),
      toggleSortDir: () => set((state) => ({ sortDir: state.sortDir === 'asc' ? 'desc' : 'asc' })),
      setStatusFilter: (statusFilter) => set({ statusFilter }),
      toggleAuthor: (author) => set((state) => ({ selectedAuthors: toggleIn(state.selectedAuthors, author) })),
      toggleGenre: (genre) => set((state) => ({ selectedGenres: toggleIn(state.selectedGenres, genre) })),
      toggleYear: (year) => set((state) => ({ selectedYears: toggleIn(state.selectedYears, year) })),
      toggleReadlistCollapsed: () => set((state) => ({ readlistCollapsed: !state.readlistCollapsed })),
      resetFilters: () =>
        set({
          statusFilter: 'all',
          selectedAuthors: [],
          selectedGenres: [],
          selectedYears: [],
        }),
    }),
    {
      name: 'library-prefs',
      storage: createJSONStorage(() => mmkvStorage),
      // 2: ownership dropped (0.2.0). Migrated rather than version-bumped bare,
      // because a bare bump throws the whole persisted blob away and takes the
      // view mode, card size and sort with it — none of which changed.
      version: 2,
      migrate: (persisted, version) => {
        const state = { ...(persisted as Record<string, unknown>) };
        if (version < 2) {
          delete state.selectedFormats;
          state.readlistCollapsed = state.wishlistCollapsed ?? false;
          delete state.wishlistCollapsed;
          if (!RETAINED_STATUS_FILTERS.has(state.statusFilter as string)) state.statusFilter = 'all';
          if (state.groupBy === 'format') state.groupBy = 'none';
          if (state.sortBy === 'price') {
            state.sortBy = 'custom';
            state.sortDir = SORT_DEFAULT_DIR.custom;
          }
        }
        return state as LibraryPrefsState;
      },
    },
  ),
);

/** How many dimensions are narrowed — the badge on the filter button. */
export function activeFilterCount(state: Pick<LibraryPrefsState, 'statusFilter' | 'selectedAuthors' | 'selectedGenres' | 'selectedYears'>): number {
  return (
    (state.statusFilter !== 'all' ? 1 : 0) +
    (state.selectedAuthors.length > 0 ? 1 : 0) +
    (state.selectedGenres.length > 0 ? 1 : 0) +
    (state.selectedYears.length > 0 ? 1 : 0)
  );
}
