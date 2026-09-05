import { BookCarousel } from '@/components/media/BookCarousel';
import type { Book } from '@/types/book';

type DiscoveryRowProps = {
  title: string;
  books: Book[];
  onPress: (book: Book) => void;
  onAdd: (book: Book) => void;
  isAdded: (book: Book) => boolean;
};

/**
 * One Browse row. `showStatus` is off because these are catalogue results, not
 * rows of yours — a reading status drawn on them would be a claim about a book
 * the shelf has never seen.
 */
export function DiscoveryRow({ title, books, onPress, onAdd, isAdded }: DiscoveryRowProps) {
  return (
    <BookCarousel
      title={title}
      books={books}
      onPress={onPress}
      onAdd={onAdd}
      isAdded={isAdded}
      showStatus={false}
    />
  );
}
