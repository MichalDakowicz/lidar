import { useEffect, useRef } from 'react';
import { Text, TextInput, View } from 'react-native';

import { useToast } from '@/components/ui/Toast';
import { LowerPageConfirm } from '@/features/books/detail/LowerPageConfirm';
import { PageMoveFields } from '@/features/books/detail/PageMoveFields';
import { PageMoveReceipt } from '@/features/books/detail/PageMoveReceipt';
import { ProgressActions } from '@/features/books/detail/ProgressActions';
import { usePageDraft } from '@/features/books/detail/usePageDraft';
import { usePageLog, type PageLogMove } from '@/features/books/detail/usePageLog';
import { authorsToDisplayString } from '@/lib/utils';
import { useBookmarkMode } from '@/store/bookmarkMode';
import type { Book } from '@/types/book';

type QuickPageLogProps = {
  book: Book;
  /** The sheet just came up — the moment to raise the keyboard. */
  opened: boolean;
  onDone: () => void;
};

/**
 * The book page's bookmark move without the book page: the same pair, the same
 * receipt, the same finish-on-the-last-page rule (usePageDraft, usePageLog).
 * No Reset — a re-read is a decision for the book page, not a long press.
 */
export function QuickPageLog({ book, opened, onDone }: QuickPageLogProps) {
  const mode = useBookmarkMode((s) => s.mode);
  const logPage = usePageLog();
  const { show } = useToast();
  const inputRef = useRef<TextInput>(null);

  const page = usePageDraft(book, mode, async (move: PageLogMove) => {
    const finished = await logPage(book, move);
    if (finished) show(`Finished ${book.title}`);
    onDone();
  });

  // The whole point of a long press is not having to tap again, so the field
  // takes focus as soon as the sheet has finished coming up.
  useEffect(() => {
    if (!opened) return;
    const timer = setTimeout(() => inputRef.current?.focus(), 250);
    return () => clearTimeout(timer);
  }, [opened, book.id]);

  const authorLine = authorsToDisplayString(book.authors);

  return (
    <View className="gap-4 p-4">
      <View className="gap-0.5">
        <Text className="text-lg font-bold text-foreground">Log pages</Text>
        <Text numberOfLines={1} className="text-sm text-muted-foreground">
          {[book.title, authorLine].filter(Boolean).join(' · ')}
        </Text>
      </View>

      <PageMoveFields
        saved={page.saved}
        draft={page.draft}
        onChange={page.setDraft}
        onSubmit={page.save}
        inputRef={inputRef}
        selectOnFocus
      />

      <PageMoveReceipt move={page.move} lastSaved={page.lastSaved} total={book.pageCount} finishes={page.finishes} />

      <ProgressActions finishes={page.finishes} canSave={page.canSave} saving={page.saving} onSave={page.save} />

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
