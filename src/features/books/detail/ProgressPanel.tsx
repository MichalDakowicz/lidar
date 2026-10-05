import { Text, View } from 'react-native';

import { SectionHeader } from '@/components/ui/SectionHeader';
import { LowerPageConfirm } from '@/features/books/detail/LowerPageConfirm';
import { PageMoveFields } from '@/features/books/detail/PageMoveFields';
import { PageMoveReceipt } from '@/features/books/detail/PageMoveReceipt';
import { PageSpanFields } from '@/features/books/detail/PageSpanFields';
import { ProgressActions } from '@/features/books/detail/ProgressActions';
import { usePageDraft } from '@/features/books/detail/usePageDraft';
import type { PageLogMove } from '@/features/books/detail/usePageLog';
import { countablePages, firstPage, pagesReadAt, progressRatio } from '@/lib/pages';
import type { BookmarkMode } from '@/lib/progress';
import { COLORS } from '@/theme/colors';
import type { Book } from '@/types/book';

import type { BookForm, FormIssues } from '../edit/bookForm';

type ProgressPanelProps = {
  book: Book;
  /** How the reader types a bookmark (Settings → Reading). */
  mode: BookmarkMode;
  /** The edit form, for the two numbers the counter is measured against. */
  form: BookForm;
  onFormChange: (patch: Partial<BookForm>) => void;
  issues?: FormIssues;
  onSetPage: (move: PageLogMove) => Promise<void> | void;
};

/**
 * Where you are in the book, and the two things you do about it: move the
 * bookmark, or clear it for a re-read.
 *
 * This is the panel that has no analogue in the sibling apps — a record is
 * played in one sitting, so Sonar logs a spin and moves on, but a book is
 * carried for weeks and the shelf is only useful if it can say how far in you
 * are.
 *
 * Two fields, not one. The left is the page already saved and cannot be typed
 * in; the right is where you are now. That pairing is the whole interaction:
 * the reader never has to remember or subtract, and the receipt line under them
 * says what the move is worth before it is written — so a wrong bookmark mode
 * shows up as an off-by-one they can see rather than as a page count that is
 * quietly wrong for the rest of the book.
 *
 * Saving writes two rows: the bookmark on the book, and the ledger row those
 * pages land on (public.book_progress). The ledger is what the streak and the
 * calendar add up — a bookmark alone cannot answer "how many pages this week".
 * A save that lands on the last page finishes the book instead, in one write,
 * so the same pages cannot be counted by both (usePageLog).
 *
 * The length of the book and the page its story starts on sit directly above
 * the counter, because they are what the counter is measured against. Which
 * number the reader types — the page finished, or the next one — is one fact
 * about a person rather than about a book, so it lives in Settings → Reading.
 */
export function ProgressPanel({
  book,
  mode,
  form,
  onFormChange,
  issues,
  onSetPage,
}: ProgressPanelProps) {
  const page = usePageDraft(book, mode, onSetPage);

  // `total` is the last page number the reader types against; `countable` is
  // how many pages that actually is once the front matter is skipped, and it is
  // the number the bar and the streak agree on (lib/pages).
  const total = book.pageCount ?? null;
  const countable = countablePages(book);
  const start = firstPage(book);
  const ratio = progressRatio(book) ?? 0;

  return (
    <View className="gap-3">
      <SectionHeader title="Progress" />

      {total ? (
        <View className="gap-1.5">
          <View className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
            <View
              className="h-full rounded-full"
              style={{ width: `${Math.round(ratio * 100)}%`, backgroundColor: COLORS.accent }}
            />
          </View>
          <Text className="text-xs text-muted-foreground">
            {book.currentPage ? `Page ${book.currentPage} of ${total}` : `${total} pages`}
            {ratio > 0 ? ` · ${Math.round(ratio * 100)}%` : ''}
            {start > 1 && countable
              ? ` · ${pagesReadAt(book, book.currentPage).toLocaleString()} of ${countable.toLocaleString()} read, from page ${start}`
              : ''}
          </Text>
        </View>
      ) : (
        <Text className="text-xs text-muted-foreground">
          No page count on this edition — fill in Pages below to get a progress bar.
        </Text>
      )}

      <PageSpanFields form={form} onChange={onFormChange} issues={issues} />

      <PageMoveFields saved={page.saved} draft={page.draft} onChange={page.setDraft} onSubmit={page.save} />

      <PageMoveReceipt move={page.move} lastSaved={page.lastSaved} total={total} finishes={page.finishes} />

      {/* Reset is the re-read: the pages already read stay in the ledger, so it
          costs the streak nothing and gives the next pass room to count. */}
      <ProgressActions
        finishes={page.finishes}
        canSave={page.canSave}
        saving={page.saving}
        onSave={page.save}
        onReset={page.reset}
      />

      <LowerPageConfirm
        visible={page.confirming}
        clearing={page.move.to == null}
        saved={page.saved}
        typed={page.draft}
        onCancel={page.cancelConfirm}
        onConfirm={page.confirm}
      />
    </View>
  );
}
