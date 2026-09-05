import { CalendarRange, Coins, Disc, Flame, Library, Play, Star, Users } from 'lucide-react-native';
import { ScrollView, Text, View } from 'react-native';

import { BookCarousel } from '@/components/media/BookCarousel';
import { CountBars } from '@/components/stats/CountBars';
import { DecadeBars } from '@/components/stats/DecadeBars';
import { QuickStat } from '@/components/stats/QuickStat';
import { RatingCurve } from '@/components/stats/RatingCurve';
import { ReadStrip } from '@/components/stats/ReadStrip';
import { ThinProgressBar } from '@/components/stats/ThinProgressBar';
import { EmptyState } from '@/components/ui/EmptyState';
import { useStats } from '@/features/stats/useStats';
import { useNavBarSpace } from '@/hooks/useNavBarSpace';
import { formatPrice } from '@/lib/utils';
import { periodShortLabel, type StatsPeriodId } from '@/lib/statsPeriod';
import { COLORS } from '@/theme/colors';
import type { Book, BookRating, Ratings, Read } from '@/types/book';

const MUTED = COLORS.muted;

type StatsViewProps = {
  books: Book[];
  reads: Read[];
  ratings: BookRating[];
  period: StatsPeriodId;
  ratingsFor?: (book: Book) => Ratings | null;
  onOpenBook?: (book: Book) => void;
  /** Own-stats screen only; the public shelf renders the pill inert. */
  onOpenPeriod?: () => void;
};

function Card({ title, children, action }: { title?: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <View className="gap-4 rounded-2xl border border-border bg-card/50 p-5">
      {(!!title || !!action) && (
        <View className="flex-row items-center justify-between">
          {!!title && <Text className="text-sm font-bold uppercase tracking-widest text-muted-foreground">{title}</Text>}
          {action}
        </View>
      )}
      {children}
    </View>
  );
}

/**
 * The whole Stats screen body, shared by your own stats and a friend's public
 * shelf so the two can never drift. Every number comes from useStats; this file
 * only lays them out.
 */
export function StatsView({ books, reads, ratings, period, ratingsFor, onOpenBook, onOpenPeriod }: StatsViewProps) {
  const { stats, distribution, perDay, streak, periodReads } = useStats({ books, reads, ratings, period });
  const navBarSpace = useNavBarSpace();

  if (books.length === 0 && ratings.length === 0) {
    return (
      <EmptyState
        icon={<Disc size={40} color={COLORS.mutedDeep} />}
        title="No numbers yet"
        description="Add a few records and log what you play — the shape shows up fast."
      />
    );
  }

  const statusMax = Math.max(stats.totalBooks + stats.wishlistCount + stats.preOrderCount, 1);

  return (
    <ScrollView
      className="flex-1"
      contentContainerClassName="gap-5 px-4 pt-4"
      contentContainerStyle={{ paddingBottom: navBarSpace + 24 }}
      showsVerticalScrollIndicator={false}
    >
      {/* The period pill: the window applies to plays, not to the shelf, so it
          sits with the listening numbers rather than at the top of the screen. */}
      <View className="flex-row flex-wrap gap-4 rounded-2xl border border-border bg-card/50 p-5">
        <View className="min-w-[45%] flex-1">
          <QuickStat value={stats.totalBooks} label="In library" icon={<Library size={16} color={MUTED} />} />
        </View>
        <View className="min-w-[45%] flex-1">
          <QuickStat value={stats.uniqueAuthors} label="Authors" icon={<Users size={16} color={MUTED} />} />
        </View>
        <View className="min-w-[45%] flex-1">
          <QuickStat
            value={stats.averageRating != null ? stats.averageRating.toFixed(1) : '—'}
            label="Avg rating"
            suffix={stats.ratedCount > 0 ? `of ${stats.ratedCount}` : undefined}
            icon={<Star size={16} color={MUTED} />}
          />
        </View>
        <View className="min-w-[45%] flex-1">
          <QuickStat
            value={stats.totalValue > 0 ? formatPrice(stats.totalValue) : '—'}
            label="Spent"
            suffix={stats.averagePrice != null ? `avg ${formatPrice(stats.averagePrice)}` : undefined}
            icon={<Coins size={16} color={MUTED} />}
          />
        </View>
      </View>

      <Card
        title="Listening"
        action={
          <View className="flex-row items-center gap-1.5">
            <CalendarRange size={13} color={onOpenPeriod ? COLORS.accent : MUTED} />
            <Text className="text-xs" style={{ color: onOpenPeriod ? COLORS.accent : MUTED }} onPress={onOpenPeriod}>
              {periodShortLabel(period)}
            </Text>
          </View>
        }
      >
        <View className="flex-row flex-wrap gap-4">
          <View className="min-w-[45%] flex-1">
            <QuickStat value={periodReads} label="Reads" icon={<Play size={16} color={MUTED} />} />
          </View>
          <View className="min-w-[45%] flex-1">
            <QuickStat value={streak} label="Day streak" suffix="days" icon={<Flame size={16} color={MUTED} />} />
          </View>
        </View>
        <ReadStrip perDay={perDay} />
      </Card>

      {stats.mostSpun.length > 0 && (
        <Card title="Most spun">
          <BookCarousel
            books={stats.mostSpun.map((entry) => entry.book)}
            cardVariant="compact"
            cardWidth={110}
            ratingsFor={ratingsFor}
            onPress={onOpenBook}
            readOnly={!onOpenBook}
          />
          <View className="gap-1.5">
            {stats.mostSpun.map((entry) => (
              <View key={entry.book.id} className="flex-row items-center justify-between gap-3">
                <Text numberOfLines={1} className="min-w-0 flex-1 text-xs text-muted-foreground">
                  {entry.book.title}
                </Text>
                <Text className="text-xs font-semibold text-foreground">{entry.count}×</Text>
              </View>
            ))}
          </View>
        </Card>
      )}

      <Card title="Shelf">
        <ThinProgressBar label="Library" value={stats.totalBooks} max={statusMax} />
        <ThinProgressBar label="Wishlist" value={stats.wishlistCount} max={statusMax} />
        <ThinProgressBar label="Pre-orders" value={stats.preOrderCount} max={statusMax} />
      </Card>

      {stats.formats.length > 0 && (
        <Card title="Formats">
          <CountBars slices={stats.formats} accent="#3b82f6" />
        </Card>
      )}

      <Card>
        <RatingCurve distribution={distribution} />
      </Card>

      {stats.bestRated.length > 0 && (
        <Card title="Rated highest">
          <BookCarousel
            books={stats.bestRated.map((entry) => entry.book)}
            cardVariant="compact"
            cardWidth={110}
            ratingsFor={ratingsFor}
            onPress={onOpenBook}
            readOnly={!onOpenBook}
          />
        </Card>
      )}

      {stats.topAuthors.length > 0 && (
        <Card title="Most collected authors">
          <CountBars slices={stats.topAuthors} />
        </Card>
      )}

      {stats.decades.length > 0 && (
        <Card title="Release eras">
          <DecadeBars decades={stats.decades} />
        </Card>
      )}

      {stats.topGenres.length > 0 && (
        <Card title="Genres">
          <CountBars slices={stats.topGenres} accent="#a855f7" />
        </Card>
      )}

      {stats.topStores.length > 0 && (
        <Card title="Where it came from">
          <CountBars slices={stats.topStores} accent="#f59e0b" />
        </Card>
      )}

      {stats.mostExpensive.length > 0 && (
        <Card title="Priciest">
          <View className="gap-2">
            {stats.mostExpensive.map((entry) => (
              <View key={entry.book.id} className="flex-row items-center justify-between gap-3">
                <Text numberOfLines={1} className="min-w-0 flex-1 text-sm text-foreground">
                  {entry.book.title}
                </Text>
                <Text className="text-sm font-semibold text-primary">{formatPrice(entry.price)}</Text>
              </View>
            ))}
          </View>
        </Card>
      )}
    </ScrollView>
  );
}
