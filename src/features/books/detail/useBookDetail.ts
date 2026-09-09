import { useMemo } from 'react';

import { useBookResult } from '@/features/books/add/useBookSearch';
import { DEFAULT_DRAFT, useQuickAdd, type QuickAddDraft } from '@/features/books/add/useQuickAdd';
import { useBooks } from '@/hooks/useBooks';
import { useBookRatings } from '@/hooks/useBookRatings';
import { useProgress } from '@/hooks/useProgress';
import { useReads } from '@/hooks/useReads';
import { googleIdFromKey } from '@/lib/bookKey';
import { finishesBook } from '@/lib/progress';
import type { Book, Progress, Ratings, Read } from '@/types/book';

export type BookDisplay = {
  bookKey: string;
  isbn13: string | null;
  googleId: string | null;
  title: string;
  subtitle: string;
  authors: string[];
  coverUrl: string | null;
  publisher: string;
  description: string;
  publishedDate: string | null;
  pageCount: number | null;
  genres: string[];
  url: string;
};

export type BookDetail = {
  /** The row on your shelf, or null when you do not own this release. */
  book: Book | null;
  /** What to draw, whether it is owned or came back from Google Books. */
  display: BookDisplay | null;
  ratings: Ratings | null;
  reads: Read[];
  /** This book's page ledger, newest first — the receipt under the bookmark. */
  progress: Progress[];
  loading: boolean;
  /** True while the release is known only by a key we cannot resolve. */
  unresolved: boolean;
  addToShelf: (draft?: QuickAddDraft) => Promise<Book | null>;
  removeFromShelf: () => Promise<void>;
  logRead: () => Promise<void>;
  removeRead: (readId: string) => Promise<void>;
  /**
   * Move the bookmark and record what the move was worth. Returns true when the
   * move reached the last page and the book was logged as finished.
   */
  setPage: (move: { page: number | null; pages: number }) => Promise<boolean>;
  /** Finishes with no date on them (Radar's undated watches, in books). */
  setUndatedReads: (undatedReads: number) => Promise<void>;
  pending: boolean;
};

/**
 * Resolves one release from either entry point, and is why there is a single
 * detail screen instead of two.
 *
 * - `/book/[bookId]` passes an id: a record on your shelf.
 * - `/release/[bookKey]` passes a release key: something from search, from
 *   Discover, or from a friend's shelf, which you may or may not own.
 *
 * Either way the screen gets the same shape, so rating, tracks and the hero are
 * written once — and rating works in both, because a rating hangs off the key
 * rather than off ownership.
 */
export function useBookDetail({ bookId, bookKey }: { bookId?: string; bookKey?: string }): BookDetail {
  const { books, loading: booksLoading, updateBook } = useBooks();
  const { ratingFor } = useBookRatings();
  const { reads, logRead, removeRead } = useReads();
  const { progress, logProgress } = useProgress();
  const { add, remove, pendingKey } = useQuickAdd();

  const book = useMemo(() => {
    if (bookId) return books.find((entry) => entry.id === bookId) ?? null;
    if (bookKey) return books.find((entry) => entry.bookKey === bookKey) ?? null;
    return null;
  }, [books, bookId, bookKey]);

  const key = book?.bookKey ?? bookKey ?? null;
  const googleId = book?.googleId ?? (key ? googleIdFromKey(key) : null);

  // Only fetched when the release is not on the shelf: an owned row already
  // carries everything the hero needs, and a network round trip on every open
  // of your own book would be a spinner for nothing.
  const { book: release, loading: releaseLoading } = useBookResult(book ? null : googleId);

  const display = useMemo<BookDisplay | null>(() => {
    if (book) {
      return {
        bookKey: book.bookKey,
        isbn13: book.isbn13,
        googleId: book.googleId,
        title: book.title,
        authors: book.authors,
        coverUrl: book.coverUrl,
        publishedDate: book.publishedDate,
        subtitle: book.subtitle,
        publisher: book.publisher,
        description: book.description,
        pageCount: book.pageCount,
        genres: book.genres,
        url: book.url,
      };
    }
    if (release) {
      return {
        bookKey: release.bookKey,
        isbn13: release.isbn13,
        googleId: release.googleId,
        title: release.title,
        authors: release.authors,
        coverUrl: release.coverUrl,
        publishedDate: release.publishedDate,
        subtitle: release.subtitle,
        publisher: release.publisher,
        description: release.description,
        pageCount: release.pageCount,
        genres: release.genres,
        url: release.url,
      };
    }
    return null;
  }, [book, release]);

  const bookReads = useMemo(
    () => (book ? reads.filter((read) => read.bookId === book.id) : []),
    [reads, book],
  );

  const bookProgress = useMemo(
    () => (book ? progress.filter((entry) => entry.bookId === book.id) : []),
    [progress, book],
  );

  return {
    book,
    display,
    ratings: ratingFor(key)?.ratings ?? null,
    reads: bookReads,
    progress: bookProgress,
    loading: booksLoading || releaseLoading,
    // A manual key with no Google Books id and no row behind it cannot be drawn —
    // the screen says so instead of rendering an empty hero.
    unresolved: !booksLoading && !releaseLoading && !book && !release,
    addToShelf: async (draft: QuickAddDraft = DEFAULT_DRAFT) => (release ? add(release, draft) : null),
    removeFromShelf: async () => {
      if (key) await remove(key);
    },
    logRead: async () => {
      if (book) await logRead(book);
    },
    removeRead,
    // Moving the bookmark is silent: a feed row per page turn would drown
    // everything else a friend did that week.
    //
    // Two writes, in this order: the live bookmark on the row, then the ledger
    // row that says what the move was worth. The bookmark alone cannot answer
    // "how many pages this week" — that is the whole reason public.book_progress
    // exists (hooks/useProgress).
    // Reaching the last page is finishing, so it takes the finish path instead
    // of this one: logRead writes the closing ledger row for exactly the pages
    // between the bookmark and the end, which is the same number this move is
    // worth. Doing both would count them twice.
    setPage: async ({ page, pages }: { page: number | null; pages: number }) => {
      if (!book) return false;
      if (finishesBook(book, page)) {
        await logRead(book);
        return true;
      }
      const recordedAt = new Date().toISOString();
      await updateBook(
        book.id,
        { currentPage: page, progressUpdatedAt: page == null ? null : recordedAt },
        { silent: true },
      );
      await logProgress(book, { page, pages, recordedAt });
      return false;
    },
    // Silent for the same reason: nobody's feed needs "remembered reading this
    // once, years ago".
    setUndatedReads: async (undatedReads: number) => {
      if (!book) return;
      await updateBook(book.id, { undatedReads: Math.max(0, Math.round(undatedReads)) }, { silent: true });
    },
    pending: !!key && pendingKey === key,
  };
}
