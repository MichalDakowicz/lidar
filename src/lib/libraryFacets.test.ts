import {
  libraryFacets,
  filterFacets,
  groupBooks,
  matchesAuthorFilter,
  matchesGenreFilter,
  matchesStatusFilter,
  matchesYearFilter,
} from './libraryFacets';
import type { Book } from '@/types/book';

function book(overrides: Partial<Book> = {}): Book {
  return {
    id: overrides.id ?? 'a',
    userId: 'u',
    isbn13: null,
    isbn10: null,
    googleId: null,
    subtitle: '',
    publisher: '',
    language: '',
    series: '',
    seriesIndex: null,
    description: '',
    startPage: null,
    currentPage: null,
    progressUpdatedAt: null,
    undatedReads: 0,
    bookKey: `manual|${overrides.id ?? 'a'}`,
    title: overrides.title ?? 'A',
    authors: overrides.authors ?? ['Author'],
    coverUrl: null,
    publishedDate: overrides.publishedDate ?? null,
    pageCount: null,
    genres: overrides.genres ?? [],
    url: '',
    status: overrides.status ?? 'Read',
    notes: '',
    favoriteQuotes: '',
    customOrder: null,
    lastReadAt: null,
    addedAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('libraryFacets', () => {
  const books = [
    book({ id: 'a', authors: ['Ursula K. Le Guin'], genres: ['Science fiction'], publishedDate: '1974-05-01' }),
    book({ id: 'b', authors: ['Italo Calvino'], genres: ['Fiction'], publishedDate: '1979-10-22' }),
    book({ id: 'c', authors: ['Ursula K. Le Guin'], publishedDate: '1979-08-27' }),
  ];

  it('derives options from what is actually on the shelf, with counts', () => {
    const facets = libraryFacets(books);
    expect(facets.authors).toEqual([
      { value: 'Italo Calvino', count: 1 },
      { value: 'Ursula K. Le Guin', count: 2 },
    ]);
    expect(facets.genres).toEqual([
      { value: 'Fiction', count: 1 },
      { value: 'Science fiction', count: 1 },
    ]);
  });

  it('sorts years newest first', () => {
    const facets = libraryFacets(books);
    expect(facets.years.map((facet) => facet.value)).toEqual(['1979', '1974']);
  });

  it('filters an option list by substring', () => {
    expect(filterFacets([{ value: 'Space opera', count: 1 }, { value: 'Memoir', count: 2 }], 'opera')).toEqual([
      { value: 'Space opera', count: 1 },
    ]);
  });
});

describe('matchers', () => {
  it('treats an empty selection as no narrowing', () => {
    const entry = book({ authors: ['Stanisław Lem'], publishedDate: '1961' });
    expect(matchesAuthorFilter(entry, [])).toBe(true);
    expect(matchesGenreFilter(entry, [])).toBe(true);
    expect(matchesYearFilter(entry, [])).toBe(true);
  });

  it('matches any credited author, not just the first', () => {
    const entry = book({ authors: ['Terry Pratchett', 'Neil Gaiman'] });
    expect(matchesAuthorFilter(entry, ['Neil Gaiman'])).toBe(true);
  });

  it('matches any credited genre', () => {
    const entry = book({ genres: ['Science fiction', 'Political fiction'] });
    expect(matchesGenreFilter(entry, ['Political fiction'])).toBe(true);
    expect(matchesGenreFilter(entry, ['Horror'])).toBe(false);
  });

  it('matches a year whatever the date precision', () => {
    expect(matchesYearFilter(book({ publishedDate: '1969' }), ['1969'])).toBe(true);
    expect(matchesYearFilter(book({ publishedDate: '1969-08-08' }), ['1969'])).toBe(true);
    expect(matchesYearFilter(book({ publishedDate: null }), ['1969'])).toBe(false);
  });

  it('passes everything when the status filter is all', () => {
    expect(matchesStatusFilter(book({ status: 'Readlist' }), 'all')).toBe(true);
    expect(matchesStatusFilter(book({ status: 'Readlist' }), 'Read')).toBe(false);
  });
});

describe('groupBooks', () => {
  const books = [
    book({ id: 'a', authors: ['Olga Tokarczuk'], publishedDate: '1997-09-16' }),
    book({ id: 'b', authors: ['Italo Calvino'], publishedDate: '2001-10-22' }),
    book({ id: 'c', publishedDate: null, genres: [] }),
  ];

  it('is null when grouping is off', () => {
    expect(groupBooks(books, 'none')).toBeNull();
  });

  it('groups by author, alphabetically', () => {
    const groups = groupBooks(books, 'author')!;
    expect(groups.map((group) => group.title)).toEqual(['Author', 'Italo Calvino', 'Olga Tokarczuk']);
  });

  it('groups by year, newest first, with a bucket for undated books', () => {
    const groups = groupBooks(books, 'year')!;
    expect(groups.map((group) => group.title)).toEqual(['Unknown year', '2001', '1997']);
  });

  it('labels a book with no genre rather than dropping it', () => {
    const groups = groupBooks([book({ id: 'x' })], 'genre')!;
    expect(groups[0].title).toBe('No genre');
  });
});
