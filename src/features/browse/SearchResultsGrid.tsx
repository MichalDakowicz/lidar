import type { FlashListRef } from '@shopify/flash-list';
import { SearchX } from 'lucide-react-native';
import type { RefObject } from 'react';

import { BookGrid } from '@/components/media/BookGrid';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { COLORS } from '@/theme/colors';
import type { Book, Ratings } from '@/types/book';

type SearchResultsGridProps = {
  results: Book[];
  loading: boolean;
  ratingsFor: (book: Book) => Ratings | null;
  onPress: (book: Book) => void;
  onAdd: (book: Book) => void;
  isAdded: (book: Book) => boolean;
  listRef?: RefObject<FlashListRef<Book> | null>;
};

/**
 * Search hits as a wall of covers, through the same grid the Library uses —
 * `showStatus` off, because a hit is a catalogue record, not a row of yours.
 *
 * A cover grid rather than the add sheet's rows on purpose: this is the tab you
 * open to look at books, and at this size the jacket is the thing you recognise.
 */
export function SearchResultsGrid({
  results,
  loading,
  ratingsFor,
  onPress,
  onAdd,
  isAdded,
  listRef,
}: SearchResultsGridProps) {
  if (loading && results.length === 0) return <LoadingState label="Searching…" />;

  return (
    <BookGrid
      listRef={listRef}
      books={results}
      ratingsFor={ratingsFor}
      onPress={onPress}
      onAdd={onAdd}
      isAdded={isAdded}
      showStatus={false}
      ListEmptyComponent={
        <EmptyState
          icon={<SearchX size={40} color={COLORS.mutedDeep} />}
          title="Nothing found"
          description="Check the spelling, or search by ISBN."
        />
      }
    />
  );
}
