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
 * Times a book has been finished: the dated reads in the log, plus the ones the
 * reader remembers without a date.
 *
 * Radar's rule (`../radar/src/lib/watchCounts.ts`), translated to books —
 * `timesRead = datedReads + undatedReads`. The undated half is stored on the
 * book row and the dated half is counted off the log, rather than Radar's
 * stored total: Lidar's dated records *are* the log, so a stored total would
 * need re-deriving on every insert and delete and could drift from it.
 */
export function datedReads(book: Book, summary: ReadSummary): number {
  return summary.countById.get(book.id) ?? 0;
}

/** Finishes with no date on them. Counted, and invisible to every calendar. */
export function undatedReads(book: Pick<Book, 'undatedReads'>): number {
  return Math.max(0, book.undatedReads ?? 0);
}

/** The number the book page shows. */
export function timesRead(book: Book, summary: ReadSummary): number {
  return datedReads(book, summary) + undatedReads(book);
}

/**
  * The books gone back to most, most-read first — Stats' "read more than once".
  * Filtered to two reads and up: every finished book has one, and a list where
  * most rows say "1x" is not a ranking of anything.
  *
  * Undated finishes count here. A book read twice before you ever tracked it is
  * a book you have read twice, and leaving it out would rank it below one you
  * happened to log.
  */
export function topRereads(books: Book[], summary: ReadSummary, limit = 5): { book: Book; count: number }[] {
  return books
    .map((book) => ({ book, count: timesRead(book, summary) }))
    .filter((entry) => entry.count > 1)
    .sort((a, b) => b.count - a.count || a.book.title.localeCompare(b.book.title))
    .slice(0, limit);
}
