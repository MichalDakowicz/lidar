import { useLocalSearchParams } from 'expo-router';

import { BookDetailScreen } from '@/features/books/detail/BookDetailScreen';

/**
 * A record on your shelf, resolved by row id (not by release key) so a
 * hand-typed book with no Google Books match still opens correctly. Renders the
 * same shared screen as /release/[bookKey].
 */
export default function BookRoute() {
  const { bookId } = useLocalSearchParams<{ bookId: string }>();
  return <BookDetailScreen bookId={bookId} />;
}
