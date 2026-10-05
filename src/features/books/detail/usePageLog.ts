import { useCallback } from 'react';

import { useBooks } from '@/hooks/useBooks';
import { useProgress } from '@/hooks/useProgress';
import { useReads } from '@/hooks/useReads';
import { finishesBook } from '@/lib/progress';
import type { Book } from '@/types/book';

export type PageLogMove = { page: number | null; pages: number };

/**
 * Moving a bookmark, from wherever it is moved — the book page or a long press
 * on Continue reading. Resolves true when the move finished the book.
 *
 * Moving the bookmark is silent: a feed row per page turn would drown
 * everything else a friend did that week.
 *
 * Two writes, in this order: the live bookmark on the row, then the ledger row
 * that says what the move was worth. The bookmark alone cannot answer "how many
 * pages this week" — that is the whole reason public.book_progress exists
 * (hooks/useProgress).
 *
 * Reaching the last page is finishing, so it takes the finish path instead of
 * this one: logRead writes the closing ledger row for exactly the pages between
 * the bookmark and the end, which is the same number this move is worth. Doing
 * both would count them twice.
 */
export function usePageLog() {
  const { updateBook } = useBooks();
  const { logRead } = useReads();
  const { logProgress } = useProgress();

  return useCallback(
    async (book: Book, { page, pages }: PageLogMove): Promise<boolean> => {
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
    [updateBook, logRead, logProgress],
  );
}
