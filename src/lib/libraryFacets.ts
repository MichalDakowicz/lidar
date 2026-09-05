import type { Book, BookStatus } from '@/types/book';

/** One filter option, with how many books it would match. */
export type Facet = { value: string; count: number };

export type LibraryFacets = {
  authors: Facet[];
  genres: Facet[];
  years: Facet[];
};

function tally(values: Iterable<string>, counts: Map<string, number>) {
  for (const value of values) {
    const clean = value.trim();
    if (clean) counts.set(clean, (counts.get(clean) ?? 0) + 1);
  }
}

function toFacets(counts: Map<string, number>, order: 'alpha' | 'desc-value' | 'count'): Facet[] {
  const list = [...counts].map(([value, count]) => ({ value, count }));
  if (order === 'desc-value') return list.sort((a, b) => b.value.localeCompare(a.value));
  if (order === 'count') return list.sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
  return list.sort((a, b) => a.value.localeCompare(b.value));
}

/**
 * Every filter dimension, derived from the books actually on the shelf — so
 * there is never a chip that matches nothing. Years sort newest first, authors
 * and genres alphabetically.
 */
export function libraryFacets(books: Book[]): LibraryFacets {
  const authors = new Map<string, number>();
  const genres = new Map<string, number>();
  const years = new Map<string, number>();

  for (const book of books) {
    tally(book.authors, authors);
    tally(book.genres, genres);
    if (book.publishedDate && book.publishedDate.length >= 4) tally([book.publishedDate.slice(0, 4)], years);
  }

  return {
    authors: toFacets(authors, 'alpha'),
    genres: toFacets(genres, 'alpha'),
    years: toFacets(years, 'desc-value'),
  };
}

export function filterFacets(facets: Facet[], query: string): Facet[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return facets;
  return facets.filter((facet) => facet.value.toLowerCase().includes(trimmed));
}

// An empty selection means "no narrowing", not "match nothing" — every one of
// these returns true when nothing is picked.

export function matchesAuthorFilter(book: Book, selected: string[]): boolean {
  return selected.length === 0 || book.authors.some((author) => selected.includes(author));
}

export function matchesGenreFilter(book: Book, selected: string[]): boolean {
  return selected.length === 0 || book.genres.some((genre) => selected.includes(genre));
}

export function matchesYearFilter(book: Book, selected: string[]): boolean {
  if (selected.length === 0) return true;
  return !!book.publishedDate && selected.includes(book.publishedDate.slice(0, 4));
}

export function matchesStatusFilter(book: Book, filter: BookStatus | 'all'): boolean {
  return filter === 'all' || book.status === filter;
}

/** Group key for one book under the chosen dimension. */
export type GroupBy = 'none' | 'author' | 'year' | 'genre' | 'status';

export function groupKeyFor(book: Book, groupBy: GroupBy): string {
  switch (groupBy) {
    case 'author':
      return book.authors[0] || 'Unknown author';
    case 'year':
      return book.publishedDate ? book.publishedDate.slice(0, 4) : 'Unknown year';
    case 'genre':
      return book.genres[0] || 'No genre';
    case 'status':
      return book.status;
    default:
      return '';
  }
}

export type BookGroup = { title: string; books: Book[] };

/** Buckets an already filtered+sorted list. Years descend; everything else A-Z. */
export function groupBooks(books: Book[], groupBy: GroupBy): BookGroup[] | null {
  if (groupBy === 'none') return null;

  const groups = new Map<string, Book[]>();
  for (const book of books) {
    const key = groupKeyFor(book, groupBy);
    const bucket = groups.get(key);
    if (bucket) bucket.push(book);
    else groups.set(key, [book]);
  }

  const keys = [...groups.keys()].sort((a, b) => (groupBy === 'year' ? b.localeCompare(a) : a.localeCompare(b)));
  return keys.map((title) => ({ title, books: groups.get(title)! }));
}
