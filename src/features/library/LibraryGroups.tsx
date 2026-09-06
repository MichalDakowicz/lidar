import { View } from 'react-native';

import { BookCard } from '@/components/media/BookCard';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { columnsFor, gapForSize } from '@/components/media/BookGrid';
import { useMeasuredWidth } from '@/hooks/useResponsive';
import type { BookGroup } from '@/lib/libraryFacets';
import type { GridSize, ViewMode } from '@/store/libraryPrefs';
import type { Book, Ratings } from '@/types/book';

type LibraryGroupsProps = {
  groups: BookGroup[];
  viewMode: ViewMode;
  gridSize: GridSize;
  ratingsFor?: (book: Book) => Ratings | null;
  onPress: (book: Book) => void;
  highlightedId?: string | null;
};

/**
 * The grouped view: a header per bucket, then that bucket's books.
 *
 * Deliberately not virtualized — a FlashList per group nested in a ScrollView
 * measures against a parent that is still laying out, and each group is a
 * handful of rows anyway. Grouping is also mutually exclusive with the plain
 * grid (the screen renders one or the other), so the virtualized path is what
 * carries a large ungrouped library.
 */
export function LibraryGroups({
  groups,
  viewMode,
  gridSize,
  ratingsFor,
  onPress,
  highlightedId,
}: LibraryGroupsProps) {
  const { width, onLayout } = useMeasuredWidth();
  const isList = viewMode === 'list';
  const columns = isList ? 1 : columnsFor(gridSize, width);
  const halfGap = isList ? 6 : gapForSize(gridSize) / 2;

  return (
    <View className="gap-8" onLayout={onLayout}>
      {groups.map((group) => (
        <View key={group.title} className="gap-2">
          <SectionHeader title={group.title} count={group.books.length} />
          <View className="flex-row flex-wrap" style={{ padding: halfGap }}>
            {group.books.map((book) => (
              <View
                key={book.id}
                style={
                  isList
                    ? { width: '100%', paddingHorizontal: halfGap, paddingBottom: halfGap * 2 }
                    : { width: `${100 / columns}%`, padding: halfGap }
                }
              >
                <BookCard
                  book={book}
                  variant={isList ? 'row' : 'cover'}
                  ratings={ratingsFor?.(book) ?? null}
                  onPress={onPress}
                  highlighted={highlightedId === book.id}
                />
              </View>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}
