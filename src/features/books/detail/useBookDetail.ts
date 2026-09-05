import { useMemo } from 'react';

import { useBookResult } from '@/features/books/add/useBookSearch';
import { DEFAULT_DRAFT, useQuickAdd, type QuickAddDraft } from '@/features/books/add/useQuickAdd';
import { useBooks } from '@/hooks/useBooks';
import { useBookRatings } from '@/hooks/useBookRatings';
import { useReads } from '@/hooks/useReads';
import { googleIdFromKey } from '@/lib/bookKey';
import type { Book, Ratings, Read } from '@/types/book';

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
  loading: boolean;
  /** True while the release is known only by a key we cannot resolve. */
  unresolved: boolean;
  addToShelf: (draft?: QuickAddDraft) => Promise<Book | null>;
  removeFromShelf: () => Promise<void>;
  logRead: () => Promise<void>;
  removeRead: (readId: string) => Promise<void>;
  setPage: (page: number | null) => Promise<void>;
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

  return {
    book,
    display,
    ratings: ratingFor(key)?.ratings ?? null,
    reads: bookReads,
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
    setPage: async (page: number | null) => {
      if (!book) return;
      await updateBook(
        book.id,
        { currentPage: page, progressUpdatedAt: page == null ? null : new Date().toISOString() },
        { silent: true },
      );
    },
    pending: !!key && pendingKey === key,
  };
}
