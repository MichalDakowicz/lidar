import { useCallback, useMemo, useState } from 'react';

import { useBooks, type NewBook } from '@/hooks/useBooks';
import { bookKey } from '@/lib/bookKey';
import type { BookResult } from '@/lib/bookMetadata';
import type { Book, BookStatus } from '@/types/book';

export type QuickAddDraft = {
  status: BookStatus;
};

/**
 * A book you have just found is one you intend to read, not one you have read —
 * the same default Radar's watchlist takes. Anything else is a claim the app
 * has no evidence for.
 */
export const DEFAULT_DRAFT: QuickAddDraft = { status: 'Readlist' };

/**
 * The shared "put this on my shelf" path: the Quick-Add sheet's search rows,
 * the barcode scanner, and a book page's add button all go through this, so
 * adding from anywhere writes the same row.
 */
export function useQuickAdd() {
  const { books, addBook, removeBook } = useBooks();
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  const byKey = useMemo(() => new Map(books.map((book) => [book.bookKey, book])), [books]);

  const findByKey = useCallback((key: string | null | undefined) => (key ? byKey.get(key) ?? null : null), [byKey]);
  const isAdded = useCallback((key: string | null | undefined) => findByKey(key) !== null, [findByKey]);

  function toPayload(found: BookResult, draft: QuickAddDraft): NewBook {
    return {
      isbn13: found.isbn13,
      isbn10: found.isbn10,
      googleId: found.googleId,
      bookKey: found.bookKey,
      title: found.title,
      subtitle: found.subtitle,
      authors: found.authors,
      coverUrl: found.coverUrl,
      publishedDate: found.publishedDate,
      pageCount: found.pageCount,
      publisher: found.publisher,
      language: found.language,
      description: found.description,
      genres: found.genres,
      url: found.url,
      status: draft.status,
    };
  }

  /** One-tap add from search or a scan: the draft defaults to the readlist. */
  const add = async (found: BookResult, draft: QuickAddDraft = DEFAULT_DRAFT): Promise<Book | null> => {
    if (isAdded(found.bookKey)) return null;
    setPendingKey(found.bookKey);
    try {
      return await addBook(toPayload(found, draft));
    } finally {
      setPendingKey(null);
    }
  };

  /**
   * "Add manually" — neither catalogue has the edition, so only what was typed
   * is known. An ISBN is still worth carrying: a scan that found nothing online
   * still identifies the book, so keying on it means this row lines up with a
   * rating made later from a search result for the same edition.
   */
  const addManual = async (
    input: {
      title: string;
      authors: string[];
      isbn13?: string | null;
      isbn10?: string | null;
      coverUrl?: string | null;
      publishedDate?: string | null;
      pageCount?: number | null;
      url?: string;
    },
    draft: QuickAddDraft = DEFAULT_DRAFT,
  ): Promise<Book | null> => {
    const key = bookKey({ isbn13: input.isbn13, isbn10: input.isbn10, title: input.title, authors: input.authors });
    setPendingKey(key);
    try {
      return await addBook({
        bookKey: key,
        isbn13: input.isbn13 ?? null,
        isbn10: input.isbn10 ?? null,
        title: input.title,
        authors: input.authors,
        coverUrl: input.coverUrl ?? null,
        publishedDate: input.publishedDate ?? null,
        pageCount: input.pageCount ?? null,
        url: input.url ?? '',
        genres: [],
        status: draft.status,
      });
    } finally {
      setPendingKey(null);
    }
  };

  const remove = async (key: string) => {
    const book = findByKey(key);
    if (!book) return;
    setPendingKey(key);
    try {
      await removeBook(book.id);
    } finally {
      setPendingKey(null);
    }
  };

  return { books, add, addManual, remove, isAdded, findByKey, pendingKey };
}
