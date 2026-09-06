import { useLocalSearchParams } from 'expo-router';
import { Lock } from 'lucide-react-native';
import { View } from 'react-native';

import { ContentShell } from '@/components/layout/ContentShell';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { StatsView } from '@/features/stats/StatsView';
import { usePublicRatings } from '@/hooks/useBookRatings';
import { usePublicProgress } from '@/hooks/useProgress';
import { useCanViewUser, usePublicBooks } from '@/hooks/usePublicBooks';
import { MAX_W } from '@/hooks/useResponsive';
import { usePublicReads } from '@/hooks/useReads';
import { COLORS } from '@/theme/colors';

/**
 * A friend's numbers, through the same StatsView your own tab renders — so the
 * two can never disagree about what "most read" means.
 *
 * Fixed at all-time: the period picker is a control of your app, and there is
 * no bar here to hang it off.
 */
export default function PublicStats() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const { canView, loading: viewLoading } = useCanViewUser(userId);
  const { books, loading } = usePublicBooks(canView ? userId : undefined);
  const { reads } = usePublicReads(canView ? userId : undefined);
  const { progress } = usePublicProgress(canView ? userId : undefined);
  const { ratings, ratingFor } = usePublicRatings(canView ? userId : undefined);

  if (viewLoading || (canView && loading)) {
    return (
      <View className="flex-1 bg-background">
        <LoadingState label="Loading stats…" />
      </View>
    );
  }

  if (canView === false) {
    return (
      <View className="flex-1 bg-background">
        <EmptyState
          icon={<Lock size={40} color={COLORS.mutedDeep} />}
          title="These stats are private"
          description="Only friends can see this library."
        />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <ContentShell fill maxWidth={MAX_W.detail}>
        <StatsView
          books={books}
          reads={reads}
          ratings={ratings}
          progress={progress}
          period="all"
          ratingsFor={(book) => ratingFor(book.bookKey)?.ratings ?? null}
        />
      </ContentShell>
    </View>
  );
}
