import { Shuffle } from 'lucide-react-native';
import { forwardRef, useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { BookCard } from '@/components/media/BookCard';
import { Sheet, type BottomSheetModal } from '@/components/ui/Sheet';
import { authorsToDisplayString } from '@/lib/utils';
import { COLORS } from '@/theme/colors';
import type { Book, Ratings } from '@/types/book';

type RandomReadSheetProps = {
  books: Book[];
  ratingsFor?: (book: Book) => Ratings | null;
  onSelect: (book: Book) => void;
  onLogRead?: (book: Book) => void;
};

/** How long the reel flicks before it settles, and how fast it swaps covers. */
const REEL_MS = 1400;
const TICK_MS = 90;

/**
 * "Put something on" — the legacy random-read modal.
 *
 * The reel is not decoration: picking blind from a shelf of hundreds feels
 * arbitrary, and watching it flick through real covers makes the result feel
 * drawn rather than decided. It settles on a seeded pick from the pool the
 * library screen already filtered, so a narrowed shelf narrows the draw.
 */
export const RandomReadSheet = forwardRef<BottomSheetModal, RandomReadSheetProps>(function RandomReadSheet(
  { books, ratingsFor, onSelect, onLogRead },
  ref,
) {
  const [index, setIndex] = useState(0);
  const [spinning, setReadning] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopAt = useRef(0);

  const read = () => {
    if (books.length === 0) return;
    setReadning(true);
    stopAt.current = Date.now() + REEL_MS;
    if (timer.current) clearInterval(timer.current);
    timer.current = setInterval(() => {
      setIndex(Math.floor(Math.random() * books.length));
      if (Date.now() >= stopAt.current) {
        if (timer.current) clearInterval(timer.current);
        timer.current = null;
        setReadning(false);
      }
    }, TICK_MS);
  };

  // Stop the reel when the sheet goes away, or the interval keeps ticking on a
  // dismissed sheet and re-renders a screen nobody is looking at.
  useEffect(
    () => () => {
      if (timer.current) clearInterval(timer.current);
    },
    [],
  );

  const book = books[Math.min(index, Math.max(books.length - 1, 0))];

  return (
    <Sheet ref={ref} snapPoints={['70%']} onChange={(snap) => (snap >= 0 ? read() : undefined)}>
      <View className="items-center gap-5 p-5">
        <Text className="text-lg font-bold text-foreground">What should I put on?</Text>

        {!book ? (
          <Text className="py-10 text-center text-sm text-muted-foreground">
            Nothing to draw from — the picker only uses books in your library that match the filters you have on.
          </Text>
        ) : (
          <>
            <View className="w-full max-w-[280px]">
              <BookCard
                book={book}
                variant="cover"
                ratings={ratingsFor?.(book) ?? null}
                readOnly
                // No crossfade while the reel is running: a 200ms transition per
                // 90ms tick just renders mud.
                coverTransitionMs={spinning ? 0 : 200}
              />
            </View>

            <View className="items-center gap-1">
              <Text numberOfLines={2} className="text-center text-base font-bold text-foreground">
                {book.title}
              </Text>
              <Text numberOfLines={1} className="text-sm text-muted-foreground">
                {authorsToDisplayString(book.authors)}
              </Text>
            </View>

            <View className="w-full gap-2">
              <Pressable
                onPress={() => onSelect(book)}
                disabled={spinning}
                className="items-center rounded-full bg-primary py-3 active:opacity-80"
                style={{ opacity: spinning ? 0.5 : 1 }}
              >
                <Text className="font-semibold text-primary-foreground">Open it</Text>
              </Pressable>

              {!!onLogRead && (
                <Pressable
                  onPress={() => onLogRead(book)}
                  disabled={spinning}
                  className="items-center rounded-full border border-border py-3 active:opacity-80"
                  style={{ opacity: spinning ? 0.5 : 1 }}
                >
                  <Text className="font-medium text-foreground">Mark it finished</Text>
                </Pressable>
              )}

              <Pressable
                onPress={read}
                disabled={spinning}
                className="flex-row items-center justify-center gap-2 py-2 active:opacity-70"
              >
                <Shuffle size={15} color={COLORS.muted} />
                <Text className="text-sm text-muted-foreground">{spinning ? 'Drawing…' : 'Draw again'}</Text>
              </Pressable>
            </View>
          </>
        )}
      </View>
    </Sheet>
  );
});
