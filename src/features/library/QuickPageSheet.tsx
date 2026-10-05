import { forwardRef, useState } from 'react';
import { View } from 'react-native';

import { Sheet, type BottomSheetModal } from '@/components/ui/Sheet';
import { QuickPageLog } from '@/features/library/QuickPageLog';
import type { Book } from '@/types/book';

type QuickPageSheetProps = {
  /** The book that was long-pressed; null before the first one. */
  book: Book | null;
  onDone: () => void;
};

/**
 * Long press on a Continue reading card: move the bookmark from the library
 * without opening the book. Sized to what it holds; the keyboard lift is the
 * sheet's own (SheetPanel).
 */
export const QuickPageSheet = forwardRef<BottomSheetModal, QuickPageSheetProps>(function QuickPageSheet(
  { book, onDone },
  ref,
) {
  const [contentHeight, setContentHeight] = useState(300);
  const [open, setOpen] = useState(false);

  return (
    <Sheet ref={ref} snapPoints={['70%']} contentHeight={contentHeight} onChange={(index) => setOpen(index >= 0)}>
      <View onLayout={({ nativeEvent }) => setContentHeight(nativeEvent.layout.height)}>
        {book && <QuickPageLog book={book} opened={open} onDone={onDone} />}
      </View>
    </Sheet>
  );
});
