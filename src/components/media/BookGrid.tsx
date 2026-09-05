import { FlashList, type FlashListRef } from '@shopify/flash-list';
import type { ReactElement, RefObject } from 'react';
import { View } from 'react-native';

import { BookCard, type BookCardVariant } from '@/components/media/BookCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { useNavBarSpace } from '@/hooks/useNavBarSpace';
import { BREAKPOINTS, useMeasuredWidth } from '@/hooks/useResponsive';
import type { Book, Ratings } from '@/types/book';

// The three size presets. These are Radar's poster columns exactly: covers are
// 2:3 here as well now, so a row fits the same number of them at a given width.
// Sonar's table had one extra column per step, which was right for square
// sleeves and squeezes a jacket to an unreadable sliver.
export type GridSize = 'compact' | 'normal' | 'large';

type ColumnSteps = { base: number; sm?: number; md?: number; lg?: number; xl?: number; '2xl'?: number; '3xl'?: number; '4xl'?: number };

const COLUMN_TABLE: Record<GridSize, ColumnSteps> = {
  compact: { base: 3, sm: 4, md: 5, lg: 6, xl: 7, '2xl': 9, '3xl': 11, '4xl': 13 },
  normal: { base: 2, md: 3, lg: 4, xl: 5, '2xl': 7, '3xl': 8, '4xl': 9 },
  large: { base: 1, sm: 2, md: 3, lg: 4, xl: 5, '2xl': 5, '3xl': 6, '4xl': 7 },
};

// Widest first: the first step the container is at least as wide as wins.
const STEPS = ['4xl', '3xl', '2xl', 'xl', 'lg', 'md', 'sm'] as const;

/**
 * Column count for a grid `width` *of the grid itself*, not of the window —
 * callers on desktop pass a measured width, since the centred content cap can
 * take hundreds of pixels off the window.
 */
export function columnsFor(size: GridSize, width: number): number {
  const table = COLUMN_TABLE[size];
  for (const step of STEPS) {
    const columns = table[step];
    if (columns && width >= BREAKPOINTS[step]) return columns;
  }
  return table.base;
}

/** Legacy gap values: compact 16px, normal/large 24px. */
export function gapForSize(size: GridSize): number {
  return size === 'compact' ? 16 : 24;
}

type BookGridProps = {
  books: Book[];
  size?: GridSize;
  variant?: BookCardVariant;
  /** Rating lookup by book key — the card shows the user's own score. */
  ratingsFor?: (book: Book) => Ratings | null;
  onPress?: (book: Book) => void;
  onLogRead?: (book: Book) => void;
  onAdd?: (book: Book) => void;
  isAdded?: (book: Book) => boolean;
  highlightedId?: string | null;
  readOnly?: boolean;
  /** Leaves room for the floating nav. Off inside another scroll container. */
  padForNavBar?: boolean;
  ListHeaderComponent?: ReactElement;
  ListFooterComponent?: ReactElement;
  ListEmptyComponent?: ReactElement;
  listRef?: RefObject<FlashListRef<Book> | null>;
  onEndReached?: () => void;
};

/**
 * The one virtualized container for a wall of covers: the library in grid or
 * list view, Browse's results, a friend's shelf. One list for both view modes
 * (`variant` picks the card), so there is no second copy of the layout maths.
 */
export function BookGrid({
  books,
  size = 'normal',
  variant = 'cover',
  ratingsFor,
  onPress,
  onLogRead,
  onAdd,
  isAdded,
  highlightedId,
  readOnly,
  padForNavBar = true,
  ListHeaderComponent,
  ListFooterComponent,
  ListEmptyComponent,
  listRef,
  onEndReached,
}: BookGridProps) {
  // Measured, not window width: on desktop the centred content column makes the
  // window much wider than this list actually gets.
  const { width, onLayout } = useMeasuredWidth();
  const navBarSpace = useNavBarSpace();
  const isList = variant === 'row';
  const columns = isList ? 1 : columnsFor(size, width);
  // Half-gap padding on both the item and the container, so edge gaps match
  // inter-card gaps.
  const halfGap = isList ? 6 : gapForSize(size) / 2;
  const bottomPad = halfGap + (padForNavBar ? navBarSpace : 0);

  return (
    <View className="flex-1" onLayout={onLayout}>
      <FlashList
        ref={listRef}
        key={`grid-${variant}-${columns}-${size}`}
        // Off by default in FlashList v2 terms: anchoring the visible item is
        // for chat, where new rows arrive above what you are reading. Here the
        // data changes because the user re-filtered, and holding their old
        // offset is precisely what strands them mid-list.
        maintainVisibleContentPosition={{ disabled: true }}
        data={books}
        numColumns={columns}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: halfGap, paddingBottom: bottomPad }}
        ListHeaderComponent={
          // Cancel the container padding so full-bleed headers reach the screen
          // edges instead of being framed by a halfGap border.
          ListHeaderComponent ? (
            <View style={{ marginHorizontal: -halfGap, marginTop: -halfGap }}>{ListHeaderComponent}</View>
          ) : undefined
        }
        ListFooterComponent={ListFooterComponent}
        ListEmptyComponent={
          ListEmptyComponent ?? <EmptyState title="Nothing here yet" description="Add a book to start your shelf." />
        }
        onEndReached={onEndReached}
        renderItem={({ item }) => (
          <View style={isList ? { paddingHorizontal: halfGap, paddingBottom: halfGap * 2 } : { flex: 1, padding: halfGap }}>
            <BookCard
              book={item}
              variant={variant}
              ratings={ratingsFor?.(item) ?? null}
              onPress={onPress}
              onLogRead={onLogRead}
              onAdd={onAdd}
              isAdded={isAdded?.(item)}
              highlighted={highlightedId === item.id}
              readOnly={readOnly}
            />
          </View>
        )}
      />
    </View>
  );
}
