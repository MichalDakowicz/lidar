import { useMemo } from 'react';

import {
  groupBooks,
  matchesAuthorFilter,
  matchesGenreFilter,
  matchesStatusFilter,
  matchesYearFilter,
  type BookGroup,
  type GroupBy,
} from '@/lib/libraryFacets';
import { isStarted } from '@/lib/bookStatus';
import { bookMatchesSearchQuery } from '@/lib/librarySearch';
import { compareBooks, type SortBy, type SortDir } from '@/lib/librarySort';
import { recentlyPlayed } from '@/lib/reads';
import type { Book, Read } from '@/types/book';
import type { StatusFilter } from '@/store/libraryPrefs';

export type LibraryFilters = {
  /** The rails above the main list. */
  recentlyPlayed: Book[];
  readlist: Book[];
  /** Everything the filters allow, minus what the rails already showed. */
  mainBooks: Book[];
  /** Grouped view of the same list, or null when grouping is off. */
  groups: BookGroup[] | null;
  /** What the random pick may draw from — books already opened. */
  readPool: Book[];
  totalCount: number;
  filteredCount: number;
};

export type LibraryFilterInput = {
  books: Book[];
  reads: Read[];
  searchQuery: string;
  statusFilter: StatusFilter;
  selectedAuthors: string[];
  selectedGenres: string[];
  selectedYears: string[];
  sortBy: SortBy;
  sortDir: SortDir;
  groupBy: GroupBy;
  /** Overall score per book, from the ratings table (0 when unrated). */
  scoreFor: (book: Book) => number;
};

/**
 * The one derive/memo hook for the library screen: the screen composes this
 * plus presentational components and holds no filter logic of its own.
 */
export function useLibraryFilters({
  books,
  reads,
  searchQuery,
  statusFilter,
  selectedAuthors,
  selectedGenres,
  selectedYears,
  sortBy,
  sortDir,
  groupBy,
  scoreFor,
}: LibraryFilterInput): LibraryFilters {
  // The rails answer "what have I finished lately" and "what is next",
  // so they are not narrowed by the filter chips — only by the search box, or
  // searching would leave two rails of non-matches at the top of the results.
  const playedRail = useMemo(() => {
    const rail = recentlyPlayed(books, reads, 12);
    return searchQuery.trim() ? rail.filter((book) => bookMatchesSearchQuery(book, searchQuery)) : rail;
  }, [books, reads, searchQuery]);

  const readlistRail = useMemo(() => {
    const rail = books
      .filter((book) => book.status === 'Readlist')
      .sort((a, b) => Date.parse(b.addedAt) - Date.parse(a.addedAt))
      .slice(0, 20);
    return searchQuery.trim() ? rail.filter((book) => bookMatchesSearchQuery(book, searchQuery)) : rail;
  }, [books, searchQuery]);

  const filtered = useMemo(() => {
    let result = books;
    if (searchQuery.trim()) result = result.filter((book) => bookMatchesSearchQuery(book, searchQuery));
    result = result.filter((book) => matchesStatusFilter(book, statusFilter));
    result = result.filter((book) => matchesAuthorFilter(book, selectedAuthors));
    result = result.filter((book) => matchesGenreFilter(book, selectedGenres));
    result = result.filter((book) => matchesYearFilter(book, selectedYears));
    return [...result].sort((a, b) => compareBooks(a, b, sortBy, sortDir, { scoreFor }));
  }, [books, searchQuery, statusFilter, selectedAuthors, selectedGenres, selectedYears, sortBy, sortDir, scoreFor]);

  const railIds = useMemo(() => {
    const ids = new Set<string>();
    // Only the readlist rail claims its books outright. A book you finished
    // yesterday still belongs in the main grid — that rail is a shortcut, not a
    // section that owns rows.
    readlistRail.forEach((book) => ids.add(book.id));
    return ids;
  }, [readlistRail]);

  const mainBooks = useMemo(
    () => (statusFilter === 'all' ? filtered.filter((book) => !railIds.has(book.id)) : filtered),
    [filtered, railIds, statusFilter],
  );

  const groups = useMemo(() => groupBooks(mainBooks, groupBy), [mainBooks, groupBy]);

  // The random picker draws from what is on the shelf and passes the filters —
  // "pick something from my science fiction" is exactly why filters exist — but
  // a readlist entry can never be picked, because you have not opened it yet.
  const readPool = useMemo(() => filtered.filter(isStarted), [filtered]);

  return {
    recentlyPlayed: playedRail,
    readlist: readlistRail,
    mainBooks,
    groups,
    readPool,
    totalCount: books.length,
    filteredCount: filtered.length,
  };
}
