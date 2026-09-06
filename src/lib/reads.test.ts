import { datedReads, summarizeReads, timesRead, topRereads, undatedReads } from './reads';
import type { Book, Read } from '@/types/book';

function read(bookId: string | null, finishedAt: string, id = `${bookId}-${finishedAt}`): Read {
  return { id, userId: 'u', bookId, bookKey: null, title: 'T', authors: [], coverUrl: null, startedAt: null, finishedAt, pageCount: null };
}

function book(id: string, title = id, undated = 0): Book {
  return {
    id,
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
    undatedReads: undated,
    bookKey: `manual|${id}`,
    title,
    authors: [],
    coverUrl: null,
    publishedDate: null,
    pageCount: null,
    genres: [],
    url: '',
    status: 'Read',
    notes: '',
    favoriteQuotes: '',
    customOrder: null,
    lastReadAt: null,
    addedAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

// A local noon so a day bucket cannot straddle midnight in either direction.
function at(day: number, hour = 12): string {
  return new Date(2026, 5, day, hour).toISOString();
}

describe('summarizeReads', () => {
  it('takes the newest play per book from a newest-first log', () => {
    const summary = summarizeReads([read('a', at(10)), read('a', at(3)), read('b', at(5))]);
    expect(summary.lastReadById.get('a')).toBe(at(10));
    expect(summary.countById.get('a')).toBe(2);
    expect(summary.totalReads).toBe(3);
  });

  it('skips reads whose book row is gone', () => {
    const summary = summarizeReads([read(null, at(1))]);
    expect(summary.countById.size).toBe(0);
    expect(summary.totalReads).toBe(1);
  });
});

describe('topRereads', () => {
  it('ranks by read count and leaves books read once out', () => {
    const books = [book('a'), book('b'), book('c')];
    const summary = summarizeReads([read('a', at(4)), read('a', at(3)), read('b', at(2)), read('b', at(1))]);
    expect(topRereads(books, summary).map((entry) => entry.book.id)).toEqual(['a', 'b']);
  });

  it('leaves out a book finished exactly once — that is not a re-read', () => {
    const summary = summarizeReads([read('a', at(1))]);
    expect(topRereads([book('a')], summary)).toEqual([]);
  });
});

describe('times finished', () => {
  it('is the dated reads plus the ones with no date on them', () => {
    const summary = summarizeReads([read('a', at(4)), read('a', at(3))]);
    expect(datedReads(book('a'), summary)).toBe(2);
    expect(timesRead(book('a', 'a', 1), summary)).toBe(3);
  });

  it('is the undated count alone for a book that was never logged', () => {
    expect(timesRead(book('a', 'a', 2), summarizeReads([]))).toBe(2);
  });

  it('refuses a negative undated count, whatever a row says', () => {
    expect(undatedReads({ undatedReads: -3 })).toBe(0);
  });
});

describe('topRereads with undated finishes', () => {
  it('ranks a book read twice before it was ever tracked', () => {
    const summary = summarizeReads([read('a', at(4)), read('a', at(3))]);
    const ranked = topRereads([book('a'), book('b', 'b', 3)], summary);
    expect(ranked.map((entry) => entry.book.id)).toEqual(['b', 'a']);
    expect(ranked.map((entry) => entry.count)).toEqual([3, 2]);
  });
});
