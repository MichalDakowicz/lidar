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
  it('counts only books you have opened as the shelf, and breaks the rest out', () => {
    const stats = computeStats({
      books: [
        book({ id: 'a' }),
        book({ id: 'b', status: 'Reading' }),
        book({ id: 'c', status: 'Did not finish' }),
        book({ id: 'd', status: 'Readlist' }),
      ],
      reads: [],
      ratings: [],
      scoreOf,
    });
    expect(stats.totalBooks).toBe(3);
    expect(stats.readCount).toBe(1);
    expect(stats.readingCount).toBe(1);
    expect(stats.dnfCount).toBe(1);
    expect(stats.readlistCount).toBe(1);
  });

  it('keeps a readlist entry out of the author and genre splits', () => {
    const stats = computeStats({
      books: [book({ id: 'a', authors: ['Read Author'] }), book({ id: 'b', status: 'Readlist', authors: ['Planned Author'] })],
      reads: [],
      ratings: [],
      scoreOf,
    });
    expect(stats.uniqueAuthors).toBe(1);
    expect(stats.topAuthors.map((slice) => slice.name)).toEqual(['Read Author']);
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

  it('ranks re-reads from the log it was given, ignoring books read once', () => {
    const stats = computeStats({
      books: [book({ id: 'a' }), book({ id: 'b' })],
      reads: [read('a'), read('a'), read('b')],
      ratings: [],
      scoreOf,
    });
    expect(stats.mostReread.map((entry) => [entry.book.id, entry.count])).toEqual([['a', 2]]);
    expect(stats.reads.totalReads).toBe(3);
  });

  it('reports empty rather than dividing by zero on a bare account', () => {
    const stats = computeStats({ books: [], reads: [], ratings: [], scoreOf });
    expect(stats.totalBooks).toBe(0);
    expect(stats.readlistCount).toBe(0);
    expect(stats.averageRating).toBeNull();
  });
});
