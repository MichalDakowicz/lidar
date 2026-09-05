import type { Book, Read } from '@/types/book';

/**
 * Derivations over the read log. The log is the source of truth — books.
 * last_read_at is only its mirror, kept so a friend's shelf can read
 * books alone without pulling that person's whole history.
 */

export type ReadSummary = {
  /** Newest listen per book id. */
  lastPlayedById: Map<string, string>;
  /** How many times each book has been played. */
  countById: Map<string, number>;
  totalReads: number;
};

/** Assumes `reads` is newest-first, which is how every query orders it. */
export function summarizeReads(reads: Read[]): ReadSummary {
  const lastPlayedById = new Map<string, string>();
  const countById = new Map<string, number>();

  for (const read of reads) {
    if (!read.bookId) continue;
    if (!lastPlayedById.has(read.bookId)) lastPlayedById.set(read.bookId, read.finishedAt);
    countById.set(read.bookId, (countById.get(read.bookId) ?? 0) + 1);
  }

  return { lastPlayedById, countById, totalReads: reads.length };
}

/** The books played most, richest first. Used by Stats' "most read" list. */
export function topSpun(books: Book[], summary: ReadSummary, limit = 5): { book: Book; count: number }[] {
  return books
    .map((book) => ({ book, count: summary.countById.get(book.id) ?? 0 }))
    .filter((entry) => entry.count > 0)
    .sort((a, b) => b.count - a.count || a.book.title.localeCompare(b.book.title))
    .slice(0, limit);
}

/**
 * The newest read per book, as a list of books — "recently played" on the
 * library screen. Books whose rows are gone are skipped: the row is what
 * the section links to.
 */
export function recentlyPlayed(books: Book[], reads: Read[], limit = 20): Book[] {
  const byId = new Map(books.map((book) => [book.id, book]));
  const seen = new Set<string>();
  const out: Book[] = [];

  for (const read of reads) {
    if (!read.bookId || seen.has(read.bookId)) continue;
    const book = byId.get(read.bookId);
    if (!book) continue;
    seen.add(read.bookId);
    out.push(book);
    if (out.length >= limit) break;
  }

  return out;
}

/** Reads inside a window, for the period-scoped stats. */
export function readsSince(reads: Read[], from: number): Read[] {
  return reads.filter((read) => new Date(read.finishedAt).getTime() >= from);
}

/**
 * Listens per day for the last `days` days, oldest first — the little activity
 * strip on Stats. Local dates, because "what did I play yesterday" is a
 * question about the user's own day, not about UTC.
 */
export function readsPerDay(reads: Read[], days: number, now = Date.now()): { date: string; count: number }[] {
  const buckets = new Map<string, number>();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const day = new Date(today);
    day.setDate(day.getDate() - offset);
    buckets.set(localDateKey(day), 0);
  }

  for (const read of reads) {
    const key = localDateKey(new Date(read.finishedAt));
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }

  return [...buckets].map(([date, count]) => ({ date, count }));
}

export function localDateKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/**
 * Consecutive days up to today with at least one listen. Yesterday still counts
 * as alive — a streak that dies at midnight before you have had a chance to put
 * a record on would be a nag, not a stat.
 */
export function listeningStreak(reads: Read[], now = Date.now()): number {
  const days = new Set(reads.map((read) => localDateKey(new Date(read.finishedAt))));
  if (days.size === 0) return 0;

  const cursor = new Date(now);
  cursor.setHours(0, 0, 0, 0);
  if (!days.has(localDateKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
    if (!days.has(localDateKey(cursor))) return 0;
  }

  let streak = 0;
  while (days.has(localDateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}
