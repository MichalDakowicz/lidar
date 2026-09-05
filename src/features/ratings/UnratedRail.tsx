import { Image } from 'expo-image';
import { Disc3 } from 'lucide-react-native';
import { useMemo } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { SectionHeader } from '@/components/ui/SectionHeader';
import { isStarted } from '@/lib/bookStatus';
import { authorsToDisplayString } from '@/lib/utils';
import { COLORS } from '@/theme/colors';
import type { Book, BookRating } from '@/types/book';
import type { RateTarget } from '@/hooks/useBookRatings';

const COVER = 96;
const LIMIT = 24;

type UnratedRailProps = {
  books: Book[];
  ratingFor: (bookKey: string | null | undefined) => BookRating | null;
  onPick: (target: RateTarget) => void;
};

/**
 * Books you have opened and never scored — the obvious next thing to rate, and
 * the only place on this page where the library is consulted at all.
 *
 * Newest first: what you read last week is what you have an opinion about.
 * Hidden entirely once the shelf is fully rated, rather than left as a
 * permanently empty row.
 */
export function UnratedRail({ books, ratingFor, onPick }: UnratedRailProps) {
  const unrated = useMemo(
    () =>
      books
        .filter((book) => isStarted(book) && !ratingFor(book.bookKey))
        .sort((a, b) => Date.parse(b.addedAt) - Date.parse(a.addedAt)),
    [books, ratingFor],
  );

  if (unrated.length === 0) return null;

  // The header counts everything still unrated, not the slice on screen: this
  // number is how much work is left, and a rail capped at two dozen covers
  // reporting "24" on a shelf of fifty says the opposite.
  const shown = unrated.slice(0, LIMIT);

  return (
    <View className="gap-2 pt-2">
      <SectionHeader title="On your shelf, unrated" count={unrated.length} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-3 px-4">
        {shown.map((book) => (
          <Pressable
            key={book.id}
            onPress={() =>
              onPick({
                bookKey: book.bookKey,
                isbn13: book.isbn13,
                title: book.title,
                authors: book.authors,
                coverUrl: book.coverUrl,
                publishedDate: book.publishedDate,
              })
            }
            className="active:opacity-70"
            style={{ width: COVER }}
          >
            <View className="overflow-hidden rounded-md bg-neutral-900" style={{ width: COVER, height: COVER }}>
              {book.coverUrl ? (
                <Image
                  source={{ uri: book.coverUrl }}
                  style={{ width: COVER, height: COVER }}
                  contentFit="cover"
                  transition={120}
                  cachePolicy="memory-disk"
                  recyclingKey={book.coverUrl}
                />
              ) : (
                <View className="h-full w-full items-center justify-center">
                  <Disc3 size={26} color={COLORS.mutedDeep} />
                </View>
              )}
            </View>
            <Text numberOfLines={1} className="pt-1 text-[11px] font-semibold text-foreground">
              {book.title}
            </Text>
            <Text numberOfLines={1} className="text-[10px] text-muted-foreground">
              {authorsToDisplayString(book.authors)}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
