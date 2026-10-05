import { isReading } from '@/lib/bookStatus';
import type { Book } from '@/types/book';

/** How many books the rail holds before it stops being a shortcut. */
export const CONTINUE_READING_LIMIT = 20;

/**
 * When you last had this book open. A bookmark move is the honest answer; a
 * book set to Reading but never bookmarked falls back to its last edit, which
 * is when it was started.
 */
function touchedAt(book: Book): number {
  const time = Date.parse(book.progressUpdatedAt ?? book.updatedAt);
  return Number.isFinite(time) ? time : 0;
}

/**
 * The books on the go, the one you moved the bookmark in last first — the rail
 * answers "pick up where I was", so the most recent one is the first card.
 */
export function continueReadingRail(books: Book[], limit = CONTINUE_READING_LIMIT): Book[] {
  return books
    .filter(isReading)
    .sort((a, b) => touchedAt(b) - touchedAt(a))
    .slice(0, limit);
}

/**
 * Where the bookmark sits, in the reader's terms: `p. 142 of 380`, or `p. 142`
 * when the edition has no page count. Null before the first bookmark.
 */
export function bookmarkLabel(book: Pick<Book, 'currentPage' | 'pageCount'>): string | null {
  if (book.currentPage == null || book.currentPage <= 0) return null;
  if (!book.pageCount || book.pageCount <= 0) return `p. ${book.currentPage}`;
  return `p. ${Math.min(book.currentPage, book.pageCount)} of ${book.pageCount}`;
}
