import type { Book } from '@/types/book';

// The library list is cached newest-added first, the order fetchBooks asks for.
// These patch one row into that cache so a single change never costs a refetch
// of the whole library.

/** Replaces the row in place, or slots a new one in where `added_at` puts it. */
export function upsertBook(list: Book[], book: Book): Book[] {
  const at = list.findIndex((b) => b.id === book.id);
  if (at >= 0) {
    const next = list.slice();
    next[at] = book;
    return next;
  }

  const slot = list.findIndex((b) => b.addedAt < book.addedAt);
  if (slot < 0) return [...list, book];
  return [...list.slice(0, slot), book, ...list.slice(slot)];
}

/** Returns the same array when the id is not in the list, so no subscriber re-renders. */
export function removeBookById(list: Book[], id: string): Book[] {
  return list.some((b) => b.id === id) ? list.filter((b) => b.id !== id) : list;
}
