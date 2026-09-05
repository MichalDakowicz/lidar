import { BookOpen, Clock, Flame, Library, Star, TrendingUp, Trophy, Users } from 'lucide-react-native';
import { View } from 'react-native';

import { QuickStat } from '@/components/stats/QuickStat';
import { COLORS } from '@/theme/colors';
import type { LibraryStats } from '@/lib/stats';

const MUTED = COLORS.muted;

/**
 * The eight numbers at the top of Stats, in Radar's bordered overview grid —
 * two per row on a phone, no card chrome, the section rules doing the framing.
 *
 * Which eight is Lidar's own call: Radar leads with runtime and completion
 * because a film is a fixed two hours. A book is not, so the pages numbers take
 * those slots — pages this year and pages a day are the closest thing a reader
 * has to "how much have I actually done".
 */
export function StatsOverview({
  stats,
  streak,
  periodReads,
}: {
  stats: LibraryStats;
  streak: number;
  periodReads: number;
}) {
  return (
    <View className="my-6 flex-row flex-wrap gap-x-4 gap-y-8 border-y border-border/50 px-4 py-8">
      <View className="w-[47%]">
        <QuickStat value={stats.totalBooks} label="Books" icon={<Library size={16} color={MUTED} />} />
      </View>
      <View className="w-[47%]">
        <QuickStat value={periodReads} label="Finished" icon={<BookOpen size={16} color={MUTED} />} />
      </View>
      <View className="w-[47%]">
        <QuickStat
          value={stats.pagesThisYear.toLocaleString()}
          label="Pages this year"
          icon={<TrendingUp size={16} color={MUTED} />}
        />
      </View>
      <View className="w-[47%]">
        <QuickStat
          value={stats.averagePagesPerDay ?? '—'}
          label="Pages a day"
          icon={<Clock size={16} color={MUTED} />}
        />
      </View>
      <View className="w-[47%]">
        <QuickStat value={stats.uniqueAuthors} label="Authors" icon={<Users size={16} color={MUTED} />} />
      </View>
      <View className="w-[47%]">
        <QuickStat
          value={stats.averageRating != null ? stats.averageRating.toFixed(1) : '—'}
          label="Avg rating"
          suffix="/5"
          icon={<Star size={16} color={MUTED} />}
        />
      </View>
      <View className="w-[47%]">
        <QuickStat value={streak} label="Day streak" icon={<Flame size={16} color={MUTED} />} />
      </View>
      <View className="w-[47%]">
        <QuickStat
          value={stats.longestBook ? stats.longestBook.pages.toLocaleString() : '—'}
          label="Longest book"
          suffix={stats.longestBook ? 'pp' : undefined}
          icon={<Trophy size={16} color={MUTED} />}
        />
      </View>
    </View>
  );
}
