import { removeBookById, upsertBook } from './bookList';
import type { Book } from '@/types/book';

const book = (id: string, addedAt: string, title = id): Book => ({ id, addedAt, title }) as Book;

describe('upsertBook', () => {
  const list = [book('c', '2026-03-01'), book('b', '2026-02-01'), book('a', '2026-01-01')];

  it('replaces an existing row in place without reordering', () => {
    const next = upsertBook(list, book('b', '2026-02-01', 'renamed'));
    expect(next.map((b) => b.id)).toEqual(['c', 'b', 'a']);
    expect(next[1].title).toBe('renamed');
  });

  it('does not mutate the list it was given', () => {
    upsertBook(list, book('b', '2026-02-01', 'renamed'));
    expect(list[1].title).toBe('b');
  });

  it('puts a new row where its added_at belongs', () => {
    expect(upsertBook(list, book('d', '2026-04-01')).map((b) => b.id)).toEqual(['d', 'c', 'b', 'a']);
    expect(upsertBook(list, book('x', '2026-02-15')).map((b) => b.id)).toEqual(['c', 'x', 'b', 'a']);
    expect(upsertBook(list, book('z', '2025-12-01')).map((b) => b.id)).toEqual(['c', 'b', 'a', 'z']);
  });

  it('seeds an empty list', () => {
    expect(upsertBook([], book('a', '2026-01-01')).map((b) => b.id)).toEqual(['a']);
  });
});

describe('removeBookById', () => {
  const list = [book('b', '2026-02-01'), book('a', '2026-01-01')];

  it('drops the row', () => {
    expect(removeBookById(list, 'b').map((b) => b.id)).toEqual(['a']);
  });

  it('returns the same array when nothing matched', () => {
    expect(removeBookById(list, 'nope')).toBe(list);
  });
});
