import {
  libraryFacets,
  filterFacets,
  groupBooks,
  matchesAuthorFilter,
  matchesFormatFilter,
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
    currentPage: null,
    progressUpdatedAt: null,
    bookKey: `manual|${overrides.id ?? 'a'}`,
    title: overrides.title ?? 'A',
    authors: overrides.authors ?? ['Author'],
    coverUrl: null,
    publishedDate: overrides.publishedDate ?? null,
    pageCount: null,
    genres: overrides.genres ?? [],
    url: '',
    formats: overrides.formats ?? ['Hardcover'],
    status: overrides.status ?? 'Library',
    notes: '',
    favoriteQuotes: '',
    acquisitionDate: null,
    storeName: overrides.storeName ?? '',
    pricePaid: null,
    edition: '',
    customOrder: null,
    lastReadAt: null,
    addedAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('libraryFacets', () => {
  const books = [
    book({ id: 'a', authors: ['Ursula K. Le Guin'], genres: ['Science fiction'], publishedDate: '1974-05-01', formats: ['Paperback'] }),
    book({ id: 'b', authors: ['Italo Calvino'], genres: ['Fiction'], publishedDate: '1979-10-22', formats: ['Hardcover', 'Paperback'] }),
    book({ id: 'c', authors: ['Ursula K. Le Guin'], publishedDate: '1979-08-27', storeName: 'Foyles', formats: ['Paperback'] }),
  ];

  it('derives options from what is actually owned, with counts', () => {
    const facets = libraryFacets(books);
    expect(facets.authors).toEqual([
      { value: 'Italo Calvino', count: 1 },
      { value: 'Ursula K. Le Guin', count: 2 },
    ]);
    expect(facets.stores).toEqual([{ value: 'Foyles', count: 1 }]);
  });

  it('sorts years newest first and formats by how common they are', () => {
    const facets = libraryFacets(books);
    expect(facets.years.map((facet) => facet.value)).toEqual(['1979', '1974']);
    expect(facets.formats[0]).toEqual({ value: 'Paperback', count: 3 });
  });

  it('filters an option list by substring', () => {
    expect(filterFacets([{ value: 'Art Pop', count: 1 }, { value: 'IDM', count: 2 }], 'pop')).toEqual([
      { value: 'Art Pop', count: 1 },
    ]);
  });
});

describe('matchers', () => {
  it('treats an empty selection as no narrowing', () => {
    const entry = book({ authors: ['Björk'], formats: ['Paperback'], publishedDate: '1997' });
    expect(matchesAuthorFilter(entry, [])).toBe(true);
    expect(matchesFormatFilter(entry, [])).toBe(true);
    expect(matchesYearFilter(entry, [])).toBe(true);
  });

  it('matches any credited author, not just the first', () => {
    const entry = book({ authors: ['Run The Jewels', 'El-P'] });
    expect(matchesAuthorFilter(entry, ['El-P'])).toBe(true);
  });

  it('matches any owned format', () => {
    const entry = book({ formats: ['Hardcover', 'Ebook'] });
    expect(matchesFormatFilter(entry, ['Ebook'])).toBe(true);
    expect(matchesFormatFilter(entry, ['Audiobook'])).toBe(false);
  });

  it('matches a year whatever the date precision', () => {
    expect(matchesYearFilter(book({ publishedDate: '1969' }), ['1969'])).toBe(true);
    expect(matchesYearFilter(book({ publishedDate: '1969-08-08' }), ['1969'])).toBe(true);
    expect(matchesYearFilter(book({ publishedDate: null }), ['1969'])).toBe(false);
  });

  it('passes everything when the status filter is all', () => {
    expect(matchesStatusFilter(book({ status: 'Wishlist' }), 'all')).toBe(true);
    expect(matchesStatusFilter(book({ status: 'Wishlist' }), 'Library')).toBe(false);
  });
});

describe('groupBooks', () => {
  const books = [
    book({ id: 'a', authors: ['Björk'], publishedDate: '1997-09-16' }),
    book({ id: 'b', authors: ['Aphex Twin'], publishedDate: '2001-10-22' }),
    book({ id: 'c', publishedDate: null, genres: [] }),
  ];

  it('is null when grouping is off', () => {
    expect(groupBooks(books, 'none')).toBeNull();
  });

  it('groups by author, alphabetically', () => {
    const groups = groupBooks(books, 'author')!;
    expect(groups.map((group) => group.title)).toEqual(['Aphex Twin', 'Author', 'Björk']);
  });

  it('groups by year, newest first, with a bucket for undated releases', () => {
    const groups = groupBooks(books, 'year')!;
    expect(groups.map((group) => group.title)).toEqual(['Unknown year', '2001', '1997']);
  });

  it('labels a release with no genre rather than dropping it', () => {
    const groups = groupBooks([book({ id: 'x' })], 'genre')!;
    expect(groups[0].title).toBe('No genre');
  });
});
