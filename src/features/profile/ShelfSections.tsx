import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

import { BookCarousel } from '@/components/media/BookCarousel';
import { SectionHeader } from '@/components/ui/SectionHeader';
import type { Book, Ratings } from '@/types/book';

type ShelfSectionsProps = {
  topRated: Book[];
  nowPlaying: Book[];
  recent: Book[];
  ratingsFor?: (book: Book) => Ratings | null;
  onOpenBook: (book: Book) => void;
  /** Owner-only blocks slot in between the rails. */
  belowTopRated?: ReactNode;
  belowNowPlaying?: ReactNode;
};

/**
 * The rails that make up a shelf, yours or a friend's. Shared so a friend's
 * shelf is literally this component with the owner-only blocks omitted.
 *
 * "Rated highest" leads, standing in for Radar's pinned top 4 — Lidar cannot
 * write that column (it is Radar's, capped at four films), and a derived list
 * needs no curating anyway.
 */
export function ShelfSections({
  topRated,
  nowPlaying,
  recent,
  ratingsFor,
  onOpenBook,
  belowTopRated,
  belowNowPlaying,
}: ShelfSectionsProps) {
  const empty = topRated.length === 0 && nowPlaying.length === 0 && recent.length === 0;

  return (
    <View className="gap-8 pt-4">
      {topRated.length > 0 && (
        <View className="gap-2">
          <SectionHeader title="Rated highest" count={topRated.length} />
          <BookCarousel
            books={topRated}
            cardVariant="cover"
            ratingsFor={ratingsFor}
            onPress={onOpenBook}
          />
        </View>
      )}

      {belowTopRated}

      {nowPlaying.length > 0 && (
        <View className="gap-2">
          <SectionHeader title="On lately" count={nowPlaying.length} />
          <BookCarousel
            books={nowPlaying}
            cardVariant="cover"
            ratingsFor={ratingsFor}
            onPress={onOpenBook}
          />
        </View>
      )}

      {belowNowPlaying}

      {recent.length > 0 && (
        <View className="gap-2">
          <SectionHeader title="Recently added" count={recent.length} />
          <BookCarousel
            books={recent}
            cardVariant="cover"
            ratingsFor={ratingsFor}
            onPress={onOpenBook}
          />
        </View>
      )}

      {empty && (
        <Text className="px-4 text-sm text-muted-foreground">
          Nothing on this shelf yet.
        </Text>
      )}
    </View>
  );
}
