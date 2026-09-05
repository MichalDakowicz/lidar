// The three numbers and two rails at the top of a shelf — yours on Profile,
// a friend's on their shelf screen. One builder, so the two never disagree.

import { isOwned } from '@/lib/bookStatus';
import { personalScore } from '@/lib/personalScore';
import type { Book, BookRating, Read } from '@/types/book';

export type ShelfStats = {
  /** Records owned — wishlist and pre-orders excluded. */
  books: number;
  /** Of those, the ones added in the current calendar year. */
  thisYear: number;
  /** Mean of every score they have given, or null if they rate nothing. */
  average: number | null;
};

function time(value: string | null | undefined): number {
  const parsed = Date.parse(value ?? '');
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function shelfStats(books: Book[], ratings: BookRating[], now: Date = new Date()): ShelfStats {
  const year = now.getFullYear();
  let owned = 0;
  let thisYear = 0;

  for (const book of books) {
    if (!isOwned(book)) continue;
    owned += 1;
    const at = time(book.addedAt);
    if (at && new Date(at).getFullYear() === year) thisYear += 1;
  }

  let total = 0;
  let scored = 0;
  for (const rating of ratings) {
    const score = personalScore(rating.ratings);
    if (score != null && score > 0) {
      total += score;
      scored += 1;
    }
  }

  return {
    books: owned,
    thisYear,
    average: scored === 0 ? null : Math.round((total / scored) * 10) / 10,
  };
}

/** Newest additions first — the poster rail under the header. */
export function recentlyAdded(books: Book[], limit = 12): Book[] {
  return [...books].sort((a, b) => time(b.addedAt) - time(a.addedAt)).slice(0, limit);
}

/**
 * What they have had on lately. Reads the read log rather than
 * books.last_read_at when it is available — the log is the source of
 * truth, the column is only its mirror.
 */
export function nowPlaying(books: Book[], reads: Read[], limit = 4): Book[] {
  if (reads.length > 0) {
    const byId = new Map(books.map((book) => [book.id, book]));
    const out: Book[] = [];
    const seen = new Set<string>();
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

  // A friend's shelf reads books alone, so it falls back to the mirror column.
  return books
    .filter((book) => book.lastReadAt)
    .sort((a, b) => time(b.lastReadAt) - time(a.lastReadAt))
    .slice(0, limit);
}

/** The releases they rate highest — Lidar's stand-in for Radar's pinned top 4. */
export function topRated(books: Book[], ratings: BookRating[], limit = 4): Book[] {
  const scoreByKey = new Map<string, number>();
  for (const rating of ratings) {
    const score = personalScore(rating.ratings);
    if (score != null && score > 0) scoreByKey.set(rating.bookKey, score);
  }

  return books
    .map((book) => ({ book, score: scoreByKey.get(book.bookKey) ?? 0 }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.book.title.localeCompare(b.book.title))
    .slice(0, limit)
    .map((entry) => entry.book);
}
