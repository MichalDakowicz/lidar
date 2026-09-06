import { BookOpen, Check, Lock } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { SectionHeader } from '@/components/ui/SectionHeader';
import { BookmarkModeToggle } from '@/features/books/detail/BookmarkModeToggle';
import { PageMoveReceipt } from '@/features/books/detail/PageMoveReceipt';
import { countablePages, firstPage, pagesReadAt, progressRatio } from '@/lib/pages';
import { displayPage, planPageMove, type BookmarkMode } from '@/lib/progress';
import { formatRelativeTime } from '@/lib/utils';
import { COLORS } from '@/theme/colors';
import type { Book } from '@/types/book';

type ProgressPanelProps = {
  book: Book;
  mode: BookmarkMode;
  onModeChange: (mode: BookmarkMode) => void;
  onSetPage: (move: { page: number | null; pages: number }) => Promise<void> | void;
  onFinish: () => Promise<void> | void;
};

/**
 * Where you are in the book, and the two things you do about it: move the
 * bookmark, or call it finished.
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
 */
export function ProgressPanel({ book, mode, onModeChange, onSetPage, onFinish }: ProgressPanelProps) {
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

  const commit = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      await onSetPage({ page: move.to, pages: move.pages });
    } finally {
      setSaving(false);
    }
  };

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
          No page count on this edition — set Pages in the details below to get a progress bar.
        </Text>
      )}

      <View className="flex-row items-end gap-2">
        <View className="flex-1 gap-1.5">
          <Text className="text-[11px] uppercase tracking-wider text-muted-foreground">Last saved</Text>
          <View className="flex-row items-center gap-2 rounded-xl border border-border bg-background px-3 py-2.5 opacity-70">
            <Lock size={14} color={COLORS.mutedDeep} />
            <Text className="flex-1 text-sm text-muted-foreground">{saved == null ? 'Not started' : saved}</Text>
          </View>
        </View>

        <View className="flex-1 gap-1.5">
          <Text className="text-[11px] uppercase tracking-wider text-muted-foreground">Now on page</Text>
          <View className="flex-row items-center gap-2 rounded-xl border border-border bg-secondary px-3 py-2.5">
            <BookOpen size={16} color={COLORS.muted} />
            <TextInput
              value={draft}
              onChangeText={setDraft}
              onSubmitEditing={commit}
              keyboardType="number-pad"
              returnKeyType="done"
              placeholder={saved == null ? 'Page…' : String(saved)}
              placeholderTextColor={COLORS.mutedDeep}
              className="flex-1 text-sm text-foreground"
              accessibilityLabel="New page"
            />
            {total ? <Text className="text-xs text-muted-foreground">/ {total}</Text> : null}
          </View>
        </View>
      </View>

      <PageMoveReceipt move={move} lastSaved={lastSaved} total={total} />

      <BookmarkModeToggle mode={mode} onChange={onModeChange} />

      <View className="flex-row items-center gap-2">
        <Pressable
          onPress={commit}
          disabled={!canSave}
          accessibilityRole="button"
          accessibilityLabel="Save the page"
          className="flex-1 items-center rounded-xl border border-border bg-secondary py-3 active:opacity-70"
          style={{ opacity: canSave ? 1 : 0.5 }}
        >
          <Text className="text-sm font-semibold text-foreground">{saving ? 'Saving…' : 'Save page'}</Text>
        </Pressable>

        <Pressable
          onPress={() => onFinish()}
          accessibilityRole="button"
          accessibilityLabel="Mark as finished"
          className="flex-row items-center gap-1.5 rounded-xl bg-primary px-4 py-3"
        >
          <Check size={16} color="#fafafa" strokeWidth={2.5} />
          <Text className="text-sm font-semibold text-primary-foreground">Finished</Text>
        </Pressable>
      </View>
    </View>
  );
}
