import type { Book } from '@/types/book';

import { bookmarkLabel, continueReadingRail } from './continueReading';

const book = (id: string, over: Partial<Book> = {}): Book =>
  ({
    id,
    status: 'Reading',
    currentPage: null,
    pageCount: null,
    progressUpdatedAt: null,
    updatedAt: '2026-10-01T00:00:00Z',
    ...over,
  }) as Book;

describe('continueReadingRail', () => {
  it('keeps only books being read', () => {
    const rail = continueReadingRail([
      book('a'),
      book('b', { status: 'Readlist' }),
      book('c', { status: 'Read' }),
      book('d', { status: 'Did not finish' }),
    ]);
    expect(rail.map((b) => b.id)).toEqual(['a']);
  });

  it('puts the last bookmark moved first', () => {
    const rail = continueReadingRail([
      book('old', { progressUpdatedAt: '2026-10-02T00:00:00Z' }),
      book('new', { progressUpdatedAt: '2026-10-04T00:00:00Z' }),
      book('mid', { progressUpdatedAt: '2026-10-03T00:00:00Z' }),
    ]);
    expect(rail.map((b) => b.id)).toEqual(['new', 'mid', 'old']);
  });

  it('falls back to the last edit for a book never bookmarked', () => {
    const rail = continueReadingRail([
      book('marked', { progressUpdatedAt: '2026-10-02T00:00:00Z' }),
      book('started', { updatedAt: '2026-10-03T00:00:00Z' }),
    ]);
    expect(rail.map((b) => b.id)).toEqual(['started', 'marked']);
  });

  it('caps the rail', () => {
    const books = Array.from({ length: 5 }, (_, i) => book(String(i)));
    expect(continueReadingRail(books, 3)).toHaveLength(3);
  });
});

describe('bookmarkLabel', () => {
  it('is null before the first bookmark', () => {
    expect(bookmarkLabel({ currentPage: null, pageCount: 380 })).toBeNull();
    expect(bookmarkLabel({ currentPage: 0, pageCount: 380 })).toBeNull();
  });

  it('names the page and the total', () => {
    expect(bookmarkLabel({ currentPage: 142, pageCount: 380 })).toBe('p. 142 of 380');
  });

  it('drops the total when the edition has none', () => {
    expect(bookmarkLabel({ currentPage: 142, pageCount: null })).toBe('p. 142');
  });

  it('clamps a bookmark past the last page', () => {
    expect(bookmarkLabel({ currentPage: 400, pageCount: 380 })).toBe('p. 380 of 380');
  });
});
