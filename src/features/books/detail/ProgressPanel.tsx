import { BookOpen, Check } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { SectionHeader } from '@/components/ui/SectionHeader';
import { COLORS } from '@/theme/colors';
import type { Book } from '@/types/book';

type ProgressPanelProps = {
  book: Book;
  onSetPage: (page: number | null) => Promise<void> | void;
  onFinish: () => Promise<void> | void;
};

/**
 * Where you are in the book, and the two things you do about it: move the
 * bookmark, or call it finished.
 *
 * This is the panel that has no analogue in the sibling apps — a record is
 * played in one sitting, so Sonar logs a spin and moves on, but a book is
 * carried for weeks and the shelf is only useful if it can say how far in you
 * are. The page number is the live bookmark on the row; finishing writes a row
 * to the read log and clears it.
 *
 * The input is uncontrolled between edits on purpose: typing "1" on the way to
 * "142" would otherwise round-trip a write per keystroke.
 */
export function ProgressPanel({ book, onSetPage, onFinish }: ProgressPanelProps) {
  const [draft, setDraft] = useState(book.currentPage ? String(book.currentPage) : '');

  // Re-sync when the row changes underneath — realtime, or the same account on
  // another device. Adjusted during render rather than in an effect: an effect
  // would paint the stale number for a frame first, and React flags the
  // cascading render it causes.
  const [seenPage, setSeenPage] = useState(book.currentPage);
  if (seenPage !== book.currentPage) {
    setSeenPage(book.currentPage);
    setDraft(book.currentPage ? String(book.currentPage) : '');
  }

  const total = book.pageCount ?? null;
  const current = Number.parseInt(draft, 10);
  const valid = Number.isFinite(current) && current >= 0 && (!total || current <= total);
  const ratio = total && book.currentPage ? Math.min(book.currentPage / total, 1) : 0;

  const commit = () => {
    if (!valid) {
      setDraft(book.currentPage ? String(book.currentPage) : '');
      return;
    }
    const next = draft.trim() === '' ? null : current;
    if (next !== book.currentPage) onSetPage(next);
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
          </Text>
        </View>
      ) : (
        <Text className="text-xs text-muted-foreground">
          No page count on this edition — set one in the details below to get a progress bar.
        </Text>
      )}

      <View className="flex-row items-center gap-2">
        <View className="flex-1 flex-row items-center gap-2 rounded-xl border border-border bg-secondary px-3 py-2.5">
          <BookOpen size={16} color={COLORS.muted} />
          <TextInput
            value={draft}
            onChangeText={setDraft}
            onBlur={commit}
            onSubmitEditing={commit}
            keyboardType="number-pad"
            returnKeyType="done"
            placeholder="On page…"
            placeholderTextColor={COLORS.mutedDeep}
            className="flex-1 text-sm text-foreground"
            accessibilityLabel="Current page"
          />
          {total ? <Text className="text-xs text-muted-foreground">/ {total}</Text> : null}
        </View>

        <Pressable
          onPress={() => onFinish()}
          accessibilityRole="button"
          accessibilityLabel="Mark as finished"
          className="flex-row items-center gap-1.5 rounded-xl bg-primary px-3.5 py-3"
        >
          <Check size={16} color="#fafafa" strokeWidth={2.5} />
          <Text className="text-sm font-semibold text-primary-foreground">Finished</Text>
        </Pressable>
      </View>
    </View>
  );
}
