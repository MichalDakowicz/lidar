import type { Book } from '@/types/book';

/**
 * Where a book's pages actually start, and how many of them there are.
 *
 * `page_count` is the last page number, not the number of pages you read. A
 * 384-page novel that opens on 17 is 368 pages of reading, and counting it as
 * 384 inflates the year's total, the day it landed on in the calendar, and
 * every progress bar along the way. One column (`books.start_page`) fixes all
 * of them, because every page sum in the app comes through here.
 *
 * A null start page means the old assumption — page 1 — so no existing row
 * changes meaning when the column arrives empty.
 */
type PageSpan = Pick<Book, 'pageCount' | 'startPage'>;
type PageProgress = PageSpan & Pick<Book, 'currentPage'>;

/** The page the story opens on. */
export function firstPage(book: PageSpan): number {
  return book.startPage && book.startPage > 0 ? book.startPage : 1;
}

/**
 * Pages there are to read, or null when the edition has no page count and a
 * guess would be worse than nothing.
 *
 * A start page past the end is a typo or an edition mismatch, not a book with
 * negative length: fall back to the raw count rather than returning a number
 * that would subtract from the streak.
 */
export function countablePages(book: PageSpan): number | null {
  if (!book.pageCount || book.pageCount <= 0) return null;
  const start = firstPage(book);
  if (start > book.pageCount) return book.pageCount;
  return book.pageCount - start + 1;
}

/** Pages behind you once you are on `page`, clamped to the book. */
export function pagesReadAt(book: PageSpan, page: number | null): number {
  const total = countablePages(book);
  if (total == null || page == null) return 0;
  const read = page - firstPage(book) + 1;
  if (read <= 0) return 0;
  return Math.min(read, total);
}

/** How far through, 0–1, or null when there is nothing to draw a bar from. */
export function progressRatio(book: PageProgress): number | null {
  const total = countablePages(book);
  if (total == null) return null;
  if (book.currentPage == null || book.currentPage <= 0) return null;
  return pagesReadAt(book, book.currentPage) / total;
}
