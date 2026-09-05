import { Trophy } from 'lucide-react-native';
import { Text, View } from 'react-native';

import { BookCarousel } from '@/components/media/BookCarousel';
import { personalScore } from '@/lib/personalScore';
import type { Book, BookRating, Ratings } from '@/types/book';

/**
 * The perfect-score shelf — Radar's Masterpieces, on books.
 *
 * Criterion: the overall score rounds to exactly 5. The rounding matters: the
 * overall is derived from four facets when it is not set by hand, so 4.97 is
 * arithmetic noise on something the reader called perfect, and 5.0 is the only
 * honest cut-off that does not exclude it.
 *
 * Ordered by score then title rather than by date, because a shelf of fives has
 * no ranking left to show and alphabetical is at least stable.
 */
export function selectMasterpieces(books: Book[], ratings: BookRating[]): Book[] {
  const scoreByKey = new Map<string, number>();
  for (const rating of ratings) {
    const score = personalScore(rating.ratings);
    if (score != null) scoreByKey.set(rating.bookKey, score);
  }

  return books
    .filter((book) => Math.round((scoreByKey.get(book.bookKey) ?? 0) * 10) / 10 >= 5)
    .sort((a, b) => a.title.localeCompare(b.title));
}

type MasterpiecesProps = {
  books: Book[];
  ratings: BookRating[];
  ratingsFor?: (book: Book) => Ratings | null;
  onPress?: (book: Book) => void;
};

export function Masterpieces({ books, ratings, ratingsFor, onPress }: MasterpiecesProps) {
  const items = selectMasterpieces(books, ratings);

  return (
    <View className="gap-3">
      <View className="flex-row items-center gap-2 px-4">
        <Trophy size={20} color="#fff" />
        <Text className="text-xl font-bold text-foreground">Masterpieces</Text>
        {items.length > 0 && <Text className="text-sm font-normal text-muted-foreground">({items.length})</Text>}
      </View>

      {items.length === 0 ? (
        <View className="mx-4 rounded-xl border border-border bg-secondary/30 px-4 py-6">
          <Text className="text-center text-sm text-muted-foreground">
            No perfect books yet — rate something 5/5 to induct it.
          </Text>
        </View>
      ) : (
        <BookCarousel books={items} ratingsFor={ratingsFor} onPress={onPress} readOnly={!onPress} />
      )}
    </View>
  );
}
