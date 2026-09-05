import { BarChart3, CalendarRange, Flame } from 'lucide-react-native';
import { ScrollView, Text, View } from 'react-native';

import { AuthorItem } from '@/components/stats/AuthorItem';
import { DecadeBars } from '@/components/stats/DecadeBars';
import { GenreTag, rankFor } from '@/components/stats/GenreTag';
import { Masterpieces } from '@/components/stats/Masterpieces';
import { RatingCurve } from '@/components/stats/RatingCurve';
import { StreakCalendar } from '@/components/stats/StreakCalendar';
import { ThinProgressBar } from '@/components/stats/ThinProgressBar';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatsOverview } from '@/features/stats/StatsOverview';
import { useStats } from '@/features/stats/useStats';
import { useNavBarSpace } from '@/hooks/useNavBarSpace';
import { periodShortLabel, type StatsPeriodId } from '@/lib/statsPeriod';
import { DEFAULT_WEEKLY_PAGES } from '@/store/readingGoal';
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
  /**
   * Own screen passes the reader's goal. A friend's shelf omits it — the goal is
   * device-local (store/readingGoal), so the only honest thing to show on
   * somebody else's numbers is the default.
   */
  weeklyGoal?: number;
};

/** Radar's section heading: a real title, not a caption on a card. */
function SectionTitle({ children }: { children: React.ReactNode }) {
  return <Text className="mb-6 text-2xl font-bold tracking-tight text-foreground">{children}</Text>;
}

/**
 * The whole Stats screen body, shared by your own stats and a friend's public
 * shelf so the two can never drift. Every number comes from useStats; this file
 * only lays them out.
 *
 * Laid out as Radar's is: full-bleed sections separated by rules and headings,
 * not a stack of rounded cards. The cards were Sonar's, and on a page that is
 * almost entirely numbers they framed every figure identically — which is a way
 * of saying none of them matters more than the others.
 */
export function StatsView({
  books,
  reads,
  ratings,
  period,
  ratingsFor,
  onOpenBook,
  onOpenPeriod,
  weeklyGoal = DEFAULT_WEEKLY_PAGES,
}: StatsViewProps) {
  const navBarSpace = useNavBarSpace();
  const bundle = useStats({ books, reads, ratings, period, weeklyGoal });
  const { stats, distribution, streak, longestStreak, weekNeeded, weekPages } = bundle;

  if (books.length === 0 && ratings.length === 0) {
    return (
      <EmptyState
        icon={<BarChart3 size={40} color={COLORS.mutedDeep} />}
        title="No numbers yet"
        description="Add a few books and log what you finish — the shape shows up fast."
      />
    );
  }

  const statusMax = Math.max(stats.totalBooks + stats.readlistCount, 1);
  const maxAuthorPages = stats.authorsByPages[0]?.pages ?? 1;

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: navBarSpace + 24 }} showsVerticalScrollIndicator={false}>
      <StatsOverview stats={stats} streak={streak} periodReads={bundle.periodReads} />

      {/* Reading streak */}
      <View className="mb-12 gap-4 px-4">
        <View className="flex-row items-center justify-between gap-3">
          <SectionTitle>Reading streak</SectionTitle>
          <View className="flex-row items-center gap-1.5 pb-6">
            <CalendarRange size={13} color={onOpenPeriod ? COLORS.accent : MUTED} />
            <Text className="text-xs" style={{ color: onOpenPeriod ? COLORS.accent : MUTED }} onPress={onOpenPeriod}>
              {periodShortLabel(period)}
            </Text>
          </View>
        </View>

        <View className="flex-row items-center gap-2">
          <Flame size={14} color={COLORS.accent} />
          <Text className="text-xs text-muted-foreground">
            {streak} days · Longest {longestStreak} · {weekPages.toLocaleString()} of {weeklyGoal.toLocaleString()} pages
            this week
            {weekNeeded > 0 ? ` · ${weekNeeded.toLocaleString()} to go` : ' · goal met'}
          </Text>
        </View>

        <StreakCalendar daily={bundle.dailyPages} weeklyGoal={weeklyGoal} />
      </View>

      <View className="mb-12">
        <Masterpieces books={books} ratings={ratings} ratingsFor={ratingsFor} onPress={onOpenBook} />
      </View>

      <View className="mb-12 px-4">
        <SectionTitle>Status breakdown</SectionTitle>
        <View className="gap-6">
          <ThinProgressBar label="Read" value={stats.readCount} max={statusMax} />
          <ThinProgressBar label="Reading" value={stats.readingCount} max={statusMax} />
          <ThinProgressBar label="Readlist" value={stats.readlistCount} max={statusMax} />
          <ThinProgressBar label="Did not finish" value={stats.dnfCount} max={statusMax} />
        </View>
      </View>

      <View className="mb-12 px-4">
        <SectionTitle>How you rate</SectionTitle>
        <RatingCurve distribution={distribution} />
      </View>

      {stats.authorsByPages.length > 0 && (
        <View className="mb-12 px-4">
          <SectionTitle>Most read authors</SectionTitle>
          <View>
            {stats.authorsByPages.map((author) => (
              <AuthorItem
                key={author.name}
                name={author.name}
                pages={author.pages}
                books={author.books}
                max={maxAuthorPages}
              />
            ))}
          </View>
        </View>
      )}

      {stats.mostReread.length > 0 && (
        <View className="mb-12 px-4">
          <SectionTitle>Read more than once</SectionTitle>
          <View className="gap-3">
            {stats.mostReread.map((entry) => (
              <View key={entry.book.id} className="flex-row items-center justify-between gap-3">
                <Text numberOfLines={1} className="min-w-0 flex-1 text-base text-foreground">
                  {entry.book.title}
                </Text>
                <Text className="text-sm font-semibold text-primary">{entry.count}×</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {stats.decades.length > 0 && (
        <View className="mb-12 px-4">
          <SectionTitle>Publication eras</SectionTitle>
          <DecadeBars decades={stats.decades} />
        </View>
      )}

      {stats.topGenres.length > 0 && (
        <View className="mb-12 px-4">
          <SectionTitle>Favourite subjects</SectionTitle>
          <View className="flex-row flex-wrap gap-3">
            {stats.topGenres.map((genre, index) => (
              <GenreTag key={genre.name} name={genre.name} count={genre.count} rank={rankFor(index)} />
            ))}
          </View>
        </View>
      )}
    </ScrollView>
  );
}
