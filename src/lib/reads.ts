import type { Book, Read } from '@/types/book';

/**
 * Derivations over the read log. The log is the source of truth — books.
 * last_read_at is only its mirror, kept so a friend's shelf can read
 * books alone without pulling that person's whole history.
 */

export type ReadSummary = {
  /** Newest finished read per book id. */
  lastReadById: Map<string, string>;
  /** How many times each book has been finished. */
  countById: Map<string, number>;
  totalReads: number;
};

/** Assumes `reads` is newest-first, which is how every query orders it. */
export function summarizeReads(reads: Read[]): ReadSummary {
  const lastReadById = new Map<string, string>();
  const countById = new Map<string, number>();

  for (const read of reads) {
    if (!read.bookId) continue;
    if (!lastReadById.has(read.bookId)) lastReadById.set(read.bookId, read.finishedAt);
    countById.set(read.bookId, (countById.get(read.bookId) ?? 0) + 1);
  }

  return { lastReadById, countById, totalReads: reads.length };
}

/**
  * The books gone back to most, most-read first — Stats' "read more than once".
  * Filtered to two reads and up: every finished book has one, and a list where
  * most rows say "1x" is not a ranking of anything.
  */
export function topRereads(books: Book[], summary: ReadSummary, limit = 5): { book: Book; count: number }[] {
  return books
    .map((book) => ({ book, count: summary.countById.get(book.id) ?? 0 }))
    .filter((entry) => entry.count > 1)
    .sort((a, b) => b.count - a.count || a.book.title.localeCompare(b.book.title))
    .slice(0, limit);
}
