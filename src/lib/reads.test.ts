import { listeningStreak, localDateKey, recentlyPlayed, readsPerDay, summarizeReads, topSpun } from './reads';
import type { Book, Read } from '@/types/book';

function read(bookId: string | null, finishedAt: string, id = `${bookId}-${finishedAt}`): Read {
  return { id, userId: 'u', bookId, bookKey: null, title: 'T', authors: [], coverUrl: null, startedAt: null, finishedAt, pageCount: null };
}

function book(id: string, title = id): Book {
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
    currentPage: null,
    progressUpdatedAt: null,
    bookKey: `manual|${id}`,
    title,
    authors: [],
    coverUrl: null,
    publishedDate: null,
    pageCount: null,
    genres: [],
    url: '',
    formats: ['Ebook'],
    status: 'Library',
    notes: '',
    favoriteQuotes: '',
    acquisitionDate: null,
    storeName: '',
    pricePaid: null,
    edition: '',
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
    expect(summary.lastPlayedById.get('a')).toBe(at(10));
    expect(summary.countById.get('a')).toBe(2);
    expect(summary.totalReads).toBe(3);
  });

  it('skips reads whose book row is gone', () => {
    const summary = summarizeReads([read(null, at(1))]);
    expect(summary.countById.size).toBe(0);
    expect(summary.totalReads).toBe(1);
  });
});

describe('topSpun', () => {
  it('ranks by play count and leaves unplayed records out', () => {
    const books = [book('a'), book('b'), book('c')];
    const summary = summarizeReads([read('a', at(3)), read('a', at(2)), read('b', at(1))]);
    expect(topSpun(books, summary).map((entry) => entry.book.id)).toEqual(['a', 'b']);
  });
});

describe('recentlyPlayed', () => {
  it('lists each book once, newest play first', () => {
    const books = [book('a'), book('b')];
    const played = recentlyPlayed(books, [read('b', at(9)), read('a', at(8)), read('b', at(2))]);
    expect(played.map((entry) => entry.id)).toEqual(['b', 'a']);
  });
});

describe('readsPerDay', () => {
  it('returns every day in the window, zeroes included', () => {
    const now = new Date(2026, 5, 10, 12).getTime();
    const perDay = readsPerDay([read('a', at(10)), read('a', at(10, 20))], 3, now);
    expect(perDay).toHaveLength(3);
    expect(perDay[2]).toEqual({ date: localDateKey(new Date(2026, 5, 10)), count: 2 });
    expect(perDay[0].count).toBe(0);
  });
});

describe('listeningStreak', () => {
  it('counts consecutive days up to today', () => {
    const now = new Date(2026, 5, 10, 9).getTime();
    expect(listeningStreak([read('a', at(10)), read('a', at(9)), read('a', at(8))], now)).toBe(3);
  });

  it('stays alive on a day with nothing played yet, counting back from yesterday', () => {
    const now = new Date(2026, 5, 11, 9).getTime();
    expect(listeningStreak([read('a', at(10)), read('a', at(9))], now)).toBe(2);
  });

  it('is broken once two days have gone by', () => {
    const now = new Date(2026, 5, 12, 9).getTime();
    expect(listeningStreak([read('a', at(10))], now)).toBe(0);
  });

  it('is zero with nothing logged', () => {
    expect(listeningStreak([])).toBe(0);
  });
});
