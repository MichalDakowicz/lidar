import { BookOpen, Lock } from 'lucide-react-native';
import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';

import { SectionHeader } from '@/components/ui/SectionHeader';
import { PageMoveReceipt } from '@/features/books/detail/PageMoveReceipt';
import { PageSpanFields } from '@/features/books/detail/PageSpanFields';
import { ProgressActions } from '@/features/books/detail/ProgressActions';
import { countablePages, firstPage, pagesReadAt, progressRatio } from '@/lib/pages';
import { displayPage, finishesBook, planPageMove, type BookmarkMode } from '@/lib/progress';
import { formatRelativeTime } from '@/lib/utils';
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
  onSetPage: (move: { page: number | null; pages: number }) => Promise<void> | void;
};

/**
 * Where you are in the book, and everything you do about it: move the bookmark,
 * send it to the last page, or clear it for a re-read.
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
 * so the same pages cannot be counted by both (useBookDetail.setPage).
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
  const saved = displayPage(book.currentPage, mode);
  const [draft, setDraft] = useState(saved == null ? '' : String(saved));
  const [saving, setSaving] = useState(false);

  // Re-sync when the row or the mode changes underneath — realtime, the same
  // account on another device, or the toggle below. Adjusted during render
  // rather than in an effect: an effect would paint the stale number for a
  // frame first, and React flags the cascading render it causes.
  const [seen, setSeen] = useState<{ page: number | null; mode: BookmarkMode }>({ page: book.currentPage, mode });
  if (seen.page !== book.currentPage || seen.mode !== mode) {
    setSeen({ page: book.currentPage, mode });
    setDraft(saved == null ? '' : String(saved));
  }

  // `total` is the last page number the reader types against; `countable` is
  // how many pages that actually is once the front matter is skipped, and it is
  // the number the bar and the streak agree on (lib/pages).
  const total = book.pageCount ?? null;
  const countable = countablePages(book);
  const start = firstPage(book);
  const ratio = progressRatio(book) ?? 0;
  const move = planPageMove(book, draft, mode);
  const lastSaved = formatRelativeTime(book.progressUpdatedAt);
  const canSave = move.valid && !move.unchanged && !saving;
  const finishes = move.valid && finishesBook(book, move.to);

  const commit = async (override?: { page: number | null; pages: number }) => {
    if (!override && !canSave) return;
    setSaving(true);
    try {
      await onSetPage(override ?? { page: move.to, pages: move.pages });
    } finally {
      setSaving(false);
    }
  };

  // Fills the field instead of saving: in "next page" mode the last page is a
  // number that does not exist in the book, so it has to be shown and priced
  // by the receipt before anyone commits to it.
  const fillLastPage = total ? () => setDraft(String(displayPage(total, mode))) : null;
  // A re-read starts from nothing. The pages already read stay in the ledger,
  // so this costs the streak nothing and gives the next pass room to count.
  const resetBookmark = book.currentPage == null || saving ? null : () => commit({ page: null, pages: 0 });

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

      {/* The pair is the whole interaction, so the two halves are the same
          width and the same height: a zero flex basis makes them equal whatever
          either one is holding. */}
      <View className="flex-row items-end gap-2">
        <View className="min-w-0 flex-1 gap-1.5" style={{ flexBasis: 0 }}>
          <Text className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Last saved</Text>
          <View className="h-11 flex-row items-center gap-2 rounded-lg border border-border bg-background px-3 opacity-70">
            <Lock size={15} color={COLORS.mutedDeep} />
            <Text numberOfLines={1} className="flex-1 text-sm text-muted-foreground">
              {saved == null ? 'Not started' : saved}
            </Text>
          </View>
        </View>

        <View className="min-w-0 flex-1 gap-1.5" style={{ flexBasis: 0 }}>
          <Text className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Now on page</Text>
          <View className="h-11 flex-row items-center gap-2 rounded-lg border border-border bg-secondary px-3">
            <BookOpen size={15} color={COLORS.muted} />
            <TextInput
              value={draft}
              onChangeText={setDraft}
              onSubmitEditing={() => commit()}
              keyboardType="number-pad"
              returnKeyType="done"
              placeholder={saved == null ? 'Page…' : String(saved)}
              placeholderTextColor={COLORS.mutedDeep}
              className="flex-1 text-sm text-foreground"
              accessibilityLabel="New page"
            />
          </View>
        </View>
      </View>

      <PageMoveReceipt move={move} lastSaved={lastSaved} total={total} finishes={finishes} />

      <ProgressActions
        finishes={finishes}
        canSave={canSave}
        saving={saving}
        onSave={() => commit()}
        onLastPage={fillLastPage}
        onReset={resetBookmark}
      />
    </View>
  );
}
