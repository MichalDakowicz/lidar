import { useLocalSearchParams } from 'expo-router';

import { BookDetailScreen } from '@/features/books/detail/BookDetailScreen';

/**
 * A release, by its key — a Google Books hit, a friend's record, a feed row. It may
 * or may not be on your shelf; the shared screen resolves that and shows the
 * owner controls only if it is.
 *
 * The rating editor is here either way, which is the point: a score belongs to
 * the release, so you can rate something you have never owned.
 */
export default function ReleaseRoute() {
  const { bookKey } = useLocalSearchParams<{ bookKey: string }>();
  return <BookDetailScreen bookKey={bookKey} />;
}
