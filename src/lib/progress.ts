import { countablePages, firstPage, pagesReadAt } from '@/lib/pages';
import type { Book } from '@/types/book';

/**
 * What one move of the bookmark means, decided before anything is written.
 *
 * "What page are you on" is ambiguous. *Page 120* can mean "I finished 120" or
 * "I am about to read 120", and a book tracked one way one week and the other
 * way the next produces a page count that is quietly wrong — which then
 * corrupts the streak. So the mode is explicit, sticky (store/bookmarkMode),
 * and resolved here rather than at the keyboard.
 *
 * Pure, so the arithmetic that feeds the streak is testable without a renderer.
 */
export type BookmarkMode = 'finished' | 'next';

type PageSpan = Pick<Book, 'pageCount' | 'startPage'>;
type Bookmark = PageSpan & Pick<Book, 'currentPage'>;

/** The last page actually read, whichever way the reader reads a bookmark. */
export function resolveTypedPage(typed: number, mode: BookmarkMode): number {
  return mode === 'next' ? typed - 1 : typed;
}

/** The number to put back in the field for a stored page, in the reader's mode. */
export function displayPage(page: number | null, mode: BookmarkMode): number | null {
  if (page == null) return null;
  return mode === 'next' ? page + 1 : page;
}

/**
 * Pages gained by moving a bookmark from one page to another.
 *
 * Never negative: a bookmark moved backwards is a correction or a re-read, and
 * neither is a reason to take pages off a week that was already read. Clamped
 * to the countable span at both ends, so typing 900 in a 384-page book cannot
 * credit 900 pages even if the guard above lets it through.
 */
export function pagesGained(book: PageSpan, from: number | null, to: number | null): number {
  return Math.max(0, pagesReadAt(book, to) - pagesReadAt(book, from));
}

/** Everything a save needs to know, and everything the receipt line shows. */
export type PageMove = {
  /** Where the bookmark is now. */
  from: number | null;
  /** Where it lands. Null clears the bookmark. */
  to: number | null;
  /** Pages this move is worth — 0 for a correction backwards. */
  pages: number;
  /** The typed page is behind the saved one: a fix, or the start of a re-read. */
  backwards: boolean;
  /** The typed page is past the last page of the book. Blocks the save. */
  beyondEnd: boolean;
  /** Nothing to write. */
  unchanged: boolean;
  /** False when the field cannot be read as a page at all. */
  valid: boolean;
};

const NOTHING: PageMove = {
  from: null,
  to: null,
  pages: 0,
  backwards: false,
  beyondEnd: false,
  unchanged: true,
  valid: false,
};

/**
 * Read the field, in the reader's mode, against the book it belongs to.
 *
 * An empty field is a valid move: it clears the bookmark, which is what "I am
 * not reading this any more" looks like. It is worth no pages either way.
 */
export function planPageMove(book: Bookmark, raw: string, mode: BookmarkMode): PageMove {
  const from = book.currentPage;
  const text = raw.trim();

  if (text === '') {
    return { from, to: null, pages: 0, backwards: false, beyondEnd: false, unchanged: from == null, valid: true };
  }

  if (!/^\d+$/.test(text)) return { ...NOTHING, from };

  const to = resolveTypedPage(Number.parseInt(text, 10), mode);
  const last = book.pageCount ?? null;
  const start = firstPage(book);

  // Below the first page is not a page of this book: in "next page" mode the
  // very first thing anyone types is the start page, which resolves to one
  // below it and means "nothing read yet".
  if (to < start - 1) return { ...NOTHING, from };
  if (last != null && to > last) {
    return { from, to, pages: 0, backwards: false, beyondEnd: true, unchanged: false, valid: false };
  }

  return {
    from,
    to,
    pages: pagesGained(book, from, to),
    backwards: from != null && to < from,
    beyondEnd: false,
    unchanged: to === from,
    valid: true,
  };
}

/**
 * The move that finishing a book makes: from wherever the bookmark is to the
 * last page.
 *
 * Without it a book read start to finish over three weeks would contribute its
 * pages twice — once through the ledger, once as the read's own page count — or
 * a book finished in one sitting would contribute none at all. The closing row
 * carries only what is left, and lib/streak stops counting the read itself once
 * the ledger has covered it.
 */
export function closingMove(book: Bookmark): { page: number | null; pages: number } {
  const total = countablePages(book);
  if (total == null) return { page: book.pageCount ?? null, pages: 0 };
  return { page: book.pageCount, pages: Math.max(0, total - pagesReadAt(book, book.currentPage)) };
}
