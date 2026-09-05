import { personalScore } from './personalScore';
import { computeStats } from './stats';
import type { Book, BookRating, Read } from '@/types/book';

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
    bookKey: overrides.bookKey ?? `manual|${overrides.id ?? 'a'}`,
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
    pricePaid: overrides.pricePaid ?? null,
    edition: '',
    customOrder: null,
    lastReadAt: null,
    addedAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function rating(bookKey: string, overall: number): BookRating {
  return {
    userId: 'u',
    bookKey,
    isbn13: null,
    title: 'T',
    authors: [],
    coverUrl: null,
    publishedDate: null,
    ratings: { overall },
    review: '',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function read(bookId: string): Read {
  return {
    id: `${bookId}-1`,
    userId: 'u',
    bookId,
    bookKey: null,
    title: 'T',
    authors: [],
    coverUrl: null,
    startedAt: null,
    finishedAt: '2026-06-01T12:00:00.000Z',
    pageCount: null,
  };
}

const scoreOf = (entry: BookRating) => personalScore(entry.ratings);

describe('computeStats', () => {
  it('counts only owned records as the library', () => {
    const stats = computeStats({
      books: [book({ id: 'a' }), book({ id: 'b', status: 'Wishlist' }), book({ id: 'c', status: 'Pre-order' })],
      reads: [],
      ratings: [],
      scoreOf,
    });
    expect(stats.totalBooks).toBe(1);
    expect(stats.wishlistCount).toBe(1);
    expect(stats.preOrderCount).toBe(1);
  });

  it('keeps a wishlist price out of what you have spent', () => {
    const stats = computeStats({
      books: [book({ id: 'a', pricePaid: 20 }), book({ id: 'b', status: 'Wishlist', pricePaid: 999 })],
      reads: [],
      ratings: [],
      scoreOf,
    });
    expect(stats.totalValue).toBe(20);
    expect(stats.averagePrice).toBe(20);
  });

  it('counts a record owned on two media once per format', () => {
    const stats = computeStats({
      books: [book({ id: 'a', formats: ['Hardcover', 'Ebook'] })],
      reads: [],
      ratings: [],
      scoreOf,
    });
    expect(stats.formats.map((slice) => [slice.name, slice.count])).toEqual([
      ['Ebook', 1],
      ['Hardcover', 1],
    ]);
    expect(stats.totalBooks).toBe(1);
  });

  it('counts every credited author, and reports how many are unique', () => {
    const stats = computeStats({
      books: [book({ id: 'a', authors: ['A', 'B'] }), book({ id: 'b', authors: ['A'] })],
      reads: [],
      ratings: [],
      scoreOf,
    });
    expect(stats.uniqueAuthors).toBe(2);
    expect(stats.topAuthors[0]).toEqual({ name: 'A', count: 2, percent: 100 });
  });

  it('buckets releases into decades in chronological order', () => {
    const stats = computeStats({
      books: [book({ id: 'a', publishedDate: '1971-03-01' }), book({ id: 'b', publishedDate: '1969' })],
      reads: [],
      ratings: [],
      scoreOf,
    });
    expect(stats.decades).toEqual([
      { decade: '1960s', count: 1 },
      { decade: '1970s', count: 1 },
    ]);
  });

  it('averages every rating, including ones for records not on the shelf', () => {
    const stats = computeStats({
      books: [book({ id: 'a', bookKey: 'k-a' })],
      reads: [],
      ratings: [rating('k-a', 4), rating('k-gone', 2)],
      scoreOf,
    });
    expect(stats.ratedCount).toBe(2);
    expect(stats.averageRating).toBe(3);
    // …but "rated highest" can only link to a record that exists.
    expect(stats.bestRated.map((entry) => entry.book.id)).toEqual(['a']);
  });

  it('ranks most spun from the log it was given', () => {
    const stats = computeStats({
      books: [book({ id: 'a' }), book({ id: 'b' })],
      reads: [read('a'), read('a'), read('b')],
      ratings: [],
      scoreOf,
    });
    expect(stats.mostSpun.map((entry) => [entry.book.id, entry.count])).toEqual([
      ['a', 2],
      ['b', 1],
    ]);
    expect(stats.reads.totalReads).toBe(3);
  });

  it('reports empty rather than dividing by zero on a bare account', () => {
    const stats = computeStats({ books: [], reads: [], ratings: [], scoreOf });
    expect(stats.totalBooks).toBe(0);
    expect(stats.averagePrice).toBeNull();
    expect(stats.averageRating).toBeNull();
  });
});
