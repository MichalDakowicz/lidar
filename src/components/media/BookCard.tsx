import { LinearGradient } from 'expo-linear-gradient';
import { Check, Play, Plus, StickyNote } from 'lucide-react-native';
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CoverImage } from '@/components/media/CoverImage';
import { RatingStars, ScoreBadge } from '@/components/media/RatingStars';
import { StatusBadge } from '@/components/media/StatusBadges';
import { useHover, webTransition } from '@/hooks/useResponsive';
import { authorsToDisplayString, cn, formatRelativeTime, publishedYear } from '@/lib/utils';
import { COLORS } from '@/theme/colors';
import type { Book, Ratings } from '@/types/book';

// The single card every screen routes covers through — model differences as
// variants and props here, never as a second copy of the markup.
export type BookCardVariant = 'cover' | 'row' | 'featured' | 'compact';

export type BookCardProps = {
  book: Book;
  variant?: BookCardVariant;
  /** The user's own rating for this book, looked up by book key. */
  ratings?: Ratings | null;
  onPress?: (book: Book) => void;
  /** Log a finished read straight from the card. */
  onLogRead?: (book: Book) => void;
  /** Browse: add a book the shelf does not have yet. */
  onAdd?: (book: Book) => void;
  isAdded?: boolean;
  highlighted?: boolean;
  readOnly?: boolean;
  /**
   * Off for catalogue results (Browse), which have no row behind them: both the
   * status badge and the not-yet-read dimming would be claims about a book the
   * shelf has never seen.
   */
  showStatus?: boolean;
  /** Cover crossfade length. 0 for rapid source swaps (the random-pick reel). */
  coverTransitionMs?: number;
};

// Memoized: rendered in every FlashList cell (grid + carousels). Without this a
// parent re-render — a filter change, a theme swap — re-renders every mounted
// card even when its own props are unchanged.
export const BookCard = memo(BookCardImpl);

function BookCardImpl(props: BookCardProps) {
  switch (props.variant) {
    case 'row':
      return <RowCard {...props} />;
    case 'featured':
      return <FeaturedCard {...props} />;
    case 'compact':
      return <CompactCard {...props} />;
    default:
      return <CoverCard {...props} />;
  }
}

/** A book you have not opened yet reads as dimmed — but only if it is yours. */
function isDimmed(book: Book, showStatus: boolean) {
  return showStatus && book.status === 'Readlist';
}

/** Finishing is only offered for a book you have actually started. */
function canLogRead(book: Book) {
  return book.status !== 'Readlist';
}

function CoverCard({
  book,
  ratings,
  onPress,
  onLogRead,
  onAdd,
  isAdded = false,
  highlighted = false,
  readOnly = false,
  showStatus = true,
  coverTransitionMs,
}: BookCardProps) {
  const authorLine = authorsToDisplayString(book.authors);
  const year = publishedYear(book.publishedDate);
  const { hovered, bind } = useHover();
  const canAdd = !!onAdd && !isAdded;

  return (
    // zIndex so the hover lift renders over its neighbours instead of under them.
    <View className="gap-1" style={hovered ? { zIndex: 10 } : undefined}>
      <Pressable
        {...bind}
        onPress={() => onPress?.(book)}
        // 2:3, the same tile Radar's posters get. A book jacket is a portrait,
        // not a sleeve — the square this inherited from Sonar was album art.
        className="relative aspect-[2/3] overflow-hidden rounded-md bg-neutral-900"
        style={[
          { cursor: 'pointer' },
          webTransition('transform'),
          highlighted ? { borderWidth: 2, borderColor: COLORS.accent } : null,
          hovered ? { transform: [{ scale: 1.035 }] } : null,
        ]}
      >
        <CoverImage
          uri={book.coverUrl}
          dimmed={isDimmed(book, showStatus)}
          transitionMs={coverTransitionMs}
          generateFor={book}
        />
        <LinearGradient
          colors={['rgba(0,0,0,0.55)', 'rgba(0,0,0,0.2)', 'transparent']}
          locations={[0, 0.25, 0.55]}
          style={StyleSheet.absoluteFill}
        />

        {/* On a phone the grid shows no title (no room, and a tap is cheap);
            with a mouse the title is what you want before clicking. */}
        {hovered && (
          <>
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.9)']}
              locations={[0.4, 1]}
              style={[StyleSheet.absoluteFill, { pointerEvents: 'none' }]}
            />
            <View className="absolute inset-x-0 bottom-0 p-2.5 pr-11" style={{ pointerEvents: 'none' }}>
              <Text numberOfLines={2} className="text-xs font-semibold leading-tight text-white">
                {book.title}
              </Text>
              {!!authorLine && (
                <Text numberOfLines={1} className="text-[10px] text-neutral-300">
                  {authorLine}
                </Text>
              )}
            </View>
          </>
        )}

        <View className="absolute inset-x-0 top-0 flex-row items-start justify-between gap-1.5 p-2.5">
          {showStatus && <StatusBadge status={book.status} />}
          {!!year && <Text className="text-[10px] font-medium text-neutral-300">{year}</Text>}
        </View>

        {!readOnly && !!onLogRead && canLogRead(book) && (
          <Pressable
            onPress={() => onLogRead(book)}
            accessibilityLabel={`Mark ${book.title} finished`}
            className="absolute bottom-2 right-2 rounded-full bg-primary/90 p-2"
          >
            <Play size={12} color="#fff" fill="#fff" />
          </Pressable>
        )}
        {!readOnly && canAdd && (
          <Pressable
            onPress={() => onAdd?.(book)}
            accessibilityLabel={`Add ${book.title}`}
            className="absolute bottom-2 right-2 rounded-full bg-primary/90 p-2"
          >
            <Plus size={12} color="#fff" />
          </Pressable>
        )}
        {/* Browse tiles for books already on the shelf: not a button, just the
            answer to "do I have this one" without opening it. */}
        {!readOnly && !!onAdd && isAdded && (
          <View className="absolute bottom-2 right-2 rounded-full bg-emerald-600/90 p-2">
            <Check size={12} color="#fff" />
          </View>
        )}
        {!readOnly && !!book.notes && (
          <View className="absolute bottom-2 left-2 rounded-full bg-neutral-800/90 p-1.5">
            <StickyNote size={12} color="#d4d4d4" />
          </View>
        )}
      </Pressable>

      <View className="flex-row items-center justify-between gap-1 px-0.5">
        <RatingStars ratings={ratings} size={10} />
        {!!book.lastReadAt && (
          <Text className="text-[10px] text-muted-foreground">{formatRelativeTime(book.lastReadAt)}</Text>
        )}
      </View>
    </View>
  );
}

function RowCard({ book, ratings, onPress, onLogRead, highlighted = false, readOnly = false, showStatus = true }: BookCardProps) {
  const authorLine = authorsToDisplayString(book.authors);
  const year = publishedYear(book.publishedDate);
  const { hovered, bind } = useHover();

  return (
    <Pressable
      {...bind}
      onPress={() => onPress?.(book)}
      style={[{ cursor: 'pointer' }, webTransition('background-color'), hovered ? { backgroundColor: 'hsl(0 0% 16%)' } : null]}
      className={cn(
        'flex-row gap-3 rounded-xl border-l-4 p-3',
        highlighted ? 'border-l-primary bg-neutral-800' : 'border-l-transparent bg-neutral-900',
      )}
    >
      <View className="h-28 w-20 overflow-hidden rounded-lg bg-neutral-800">
        <CoverImage uri={book.coverUrl} dimmed={isDimmed(book, showStatus)} iconSize={22} generateFor={book} />
      </View>

      <View className="min-w-0 flex-1 justify-center gap-1">
        <Text numberOfLines={1} className="text-base font-bold text-foreground">
          {book.title}
        </Text>
        <Text numberOfLines={1} className="text-xs text-muted-foreground">
          {[authorLine, year].filter(Boolean).join(' • ')}
        </Text>
        <RatingStars ratings={ratings} size={10} />
      </View>

      <View className="items-end gap-1">
        {showStatus && <StatusBadge status={book.status} size={15} />}
        {!readOnly && !!onLogRead && canLogRead(book) && (
          <Pressable
            onPress={() => onLogRead(book)}
            accessibilityLabel={`Mark ${book.title} finished`}
            hitSlop={8}
            className="rounded-full bg-primary/15 p-2"
          >
            <Play size={14} color={COLORS.accent} fill={COLORS.accent} />
          </Pressable>
        )}
      </View>
    </Pressable>
  );
}

/**
 * Wide banner for the library's own sections (Recently finished, Readlist).
 * Crops the cover to 16:9 on purpose: a row of cards at full width reads as a
 * list of tiles, and the banner is what makes a section feel like a shelf
 * rather than more grid.
 */
function FeaturedCard({ book, ratings, onPress, onLogRead, highlighted = false, readOnly = false, showStatus = true }: BookCardProps) {
  const authorLine = authorsToDisplayString(book.authors);
  const lastRead = formatRelativeTime(book.lastReadAt);

  return (
    <Pressable
      onPress={() => onPress?.(book)}
      className="relative aspect-video w-full overflow-hidden rounded-xl bg-neutral-900"
      style={[{ cursor: 'pointer' }, highlighted ? { borderWidth: 2, borderColor: COLORS.accent } : null]}
    >
      <CoverImage uri={book.coverUrl} dimmed={isDimmed(book, showStatus)} iconSize={40} />
      {/* Left veil anchors the text, bottom veil keeps the meta legible. */}
      <LinearGradient
        colors={['rgba(0,0,0,0.85)', 'rgba(0,0,0,0.15)', 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient colors={['transparent', 'rgba(0,0,0,0.65)']} locations={[0.4, 1]} style={StyleSheet.absoluteFill} />

      <View className="absolute inset-x-0 top-0 flex-row items-start justify-between p-3">
        {showStatus && <StatusBadge status={book.status} />}
        <ScoreBadge ratings={ratings} />
      </View>

      <View className="absolute inset-x-0 bottom-0 gap-1 px-4 pb-4">
        <Text numberOfLines={1} className="text-xl font-bold leading-tight text-white">
          {book.title}
        </Text>
        <View className="flex-row items-center gap-2">
          {!!authorLine && (
            <Text numberOfLines={1} className="flex-1 text-xs text-neutral-300">
              {authorLine}
            </Text>
          )}
          {!!lastRead && <Text className="text-[11px] text-neutral-400">{lastRead}</Text>}
        </View>
      </View>

      {!readOnly && !!onLogRead && canLogRead(book) && (
        <Pressable
          onPress={() => onLogRead(book)}
          accessibilityLabel={`Mark ${book.title} finished`}
          className="absolute bottom-4 right-4 rounded-full bg-primary p-3"
        >
          <Play size={16} color="#fff" fill="#fff" />
        </Pressable>
      )}
    </Pressable>
  );
}

function CompactCard({ book, ratings, onPress, highlighted = false, showStatus = true }: BookCardProps) {
  const { hovered, bind } = useHover();

  return (
    <Pressable
      {...bind}
      onPress={() => onPress?.(book)}
      className="relative aspect-[2/3] overflow-hidden rounded-md bg-neutral-900"
      style={[
        { cursor: 'pointer' },
        webTransition('transform'),
        highlighted ? { borderWidth: 2, borderColor: COLORS.accent } : null,
        hovered ? { transform: [{ scale: 1.04 }], zIndex: 10 } : null,
      ]}
    >
      <CoverImage uri={book.coverUrl} dimmed={isDimmed(book, showStatus)} iconSize={22} generateFor={book} />
      <View className="absolute left-1.5 top-1.5 flex-row items-center gap-1">
        {showStatus && <StatusBadge status={book.status} size={11} />}
        <ScoreBadge ratings={ratings} />
      </View>
      <View className="absolute inset-x-0 bottom-0 bg-black/65 px-1.5 py-1">
        <Text numberOfLines={1} className="text-[11px] font-semibold text-white">
          {book.title}
        </Text>
      </View>
    </Pressable>
  );
}
