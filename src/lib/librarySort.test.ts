import { canReorder, compareBooks, orderBetween, shelfOrder, SORT_DEFAULT_DIR } from './librarySort';
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
    bookKey: overrides.bookKey ?? `manual:x|${overrides.title ?? 'a'}`,
    title: overrides.title ?? 'A',
    authors: overrides.authors ?? ['Author'],
    coverUrl: null,
    publishedDate: overrides.publishedDate ?? null,
    pageCount: null,
    genres: [],
    url: '',
    formats: ['Ebook'],
    status: overrides.status ?? 'Library',
    notes: '',
    favoriteQuotes: '',
    acquisitionDate: null,
    storeName: '',
    pricePaid: overrides.pricePaid ?? null,
    edition: '',
    customOrder: overrides.customOrder ?? null,
    lastReadAt: overrides.lastReadAt ?? null,
    addedAt: overrides.addedAt ?? '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

const noScores = { scoreFor: () => 0 };

describe('shelfOrder', () => {
  it('uses customOrder when a record has been dragged', () => {
    expect(shelfOrder(book({ customOrder: 42 }))).toBe(42);
  });

  it('falls back to negated add time, so an untouched shelf reads newest-first', () => {
    const older = book({ addedAt: '2026-01-01T00:00:00.000Z' });
    const newer = book({ addedAt: '2026-06-01T00:00:00.000Z' });
    expect(shelfOrder(newer)).toBeLessThan(shelfOrder(older));
  });
});

describe('orderBetween', () => {
  it('puts a record before the first one', () => {
    const first = book({ customOrder: 0 });
    expect(orderBetween(undefined, first)).toBeLessThan(0);
  });

  it('puts a record after the last one', () => {
    const last = book({ customOrder: 0 });
    expect(orderBetween(last, undefined)).toBeGreaterThan(0);
  });

  it('takes the midpoint between two neighbours', () => {
    expect(orderBetween(book({ customOrder: 100 }), book({ customOrder: 200 }))).toBe(150);
  });
});

describe('compareBooks', () => {
  it('sorts by title ascending', () => {
    const list = [book({ title: 'Zoo' }), book({ title: 'Apple' })];
    list.sort((a, b) => compareBooks(a, b, 'title', 'asc', noScores));
    expect(list.map((entry) => entry.title)).toEqual(['Apple', 'Zoo']);
  });

  it('sorts by rating using the injected score', () => {
    const good = book({ id: 'good', bookKey: 'k-good' });
    const bad = book({ id: 'bad', bookKey: 'k-bad' });
    const scoreFor = (entry: Book) => (entry.bookKey === 'k-good' ? 4.5 : 1);
    const list = [bad, good];
    list.sort((a, b) => compareBooks(a, b, 'rating', 'desc', { scoreFor }));
    expect(list[0].id).toBe('good');
  });

  it('treats a never-played record as older than any play', () => {
    const played = book({ id: 'played', lastReadAt: '2026-01-01T00:00:00.000Z' });
    const never = book({ id: 'never' });
    const list = [never, played];
    list.sort((a, b) => compareBooks(a, b, 'lastRead', 'desc', noScores));
    expect(list[0].id).toBe('played');
  });

  it('breaks ties on title so the grid never reshuffles between renders', () => {
    const b = book({ id: 'b', title: 'B' });
    const a = book({ id: 'a', title: 'A' });
    // Same (absent) price, so the price comparison is a tie.
    expect(compareBooks(b, a, 'price', 'asc', noScores)).toBeGreaterThan(0);
    expect(compareBooks(a, b, 'price', 'asc', noScores)).toBeLessThan(0);
  });

  it('every sort has a natural direction', () => {
    expect(SORT_DEFAULT_DIR.dateAdded).toBe('desc');
    expect(SORT_DEFAULT_DIR.title).toBe('asc');
  });
});

describe('canReorder', () => {
  const base = { sortBy: 'custom' as const, groupBy: 'none', searchQuery: '', activeFilterCount: 0 };

  it('allows hand order only on the whole, unsorted shelf', () => {
    expect(canReorder(base)).toBe(true);
    expect(canReorder({ ...base, sortBy: 'title' })).toBe(false);
    expect(canReorder({ ...base, groupBy: 'author' })).toBe(false);
    expect(canReorder({ ...base, searchQuery: 'kid a' })).toBe(false);
    expect(canReorder({ ...base, activeFilterCount: 1 })).toBe(false);
  });
});
