import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { Clock } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { ContentShell } from '@/components/layout/ContentShell';
import { ScreenTop } from '@/components/layout/ScreenTop';
import { RatingCurve } from '@/components/stats/RatingCurve';
import { ErrorState } from '@/components/ui/ErrorState';
import { LoadingState } from '@/components/ui/LoadingState';
import type { BottomSheetModal } from '@/components/ui/Sheet';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/features/auth/AuthProvider';
import { EditProfileSheet } from '@/features/profile/EditProfileSheet';
import { MyShelfHeader } from '@/features/profile/MyShelfHeader';
import { RandomReadSheet } from '@/features/profile/RandomReadSheet';
import { ShelfSections } from '@/features/profile/ShelfSections';
import { ReadPromptCard } from '@/features/profile/ReadPromptCard';
import { useBookRatings } from '@/hooks/useBookRatings';
import { useBooks } from '@/hooks/useBooks';
import { useNavBarSpace } from '@/hooks/useNavBarSpace';
import { useProfile } from '@/hooks/useProfile';
import { MAX_W } from '@/hooks/useResponsive';
import { useReads } from '@/hooks/useReads';
import { isStarted } from '@/lib/bookStatus';
import { ratingDistribution } from '@/lib/ratingDistribution';
import { publicShelfUrl } from '@/lib/shelfLink';
import { nowPlaying, recentlyAdded, shelfStats, topRated } from '@/lib/shelfSummary';
import { COLORS } from '@/theme/colors';
import { withTabReload } from '@/store/tabReload';
import type { Book } from '@/types/book';

/** Nothing logged in this long counts as neglected by the picker. */
const NEGLECTED_DAYS = 60;

/**
 * Your own shelf, built from the same pieces a friend's shelf is
 * (features/profile/ShelfSections) so the two never drift: what you see here is
 * what they see there, plus the owner-only affordances. Settings is the nav
 * bar's action on this tab.
 */
export default withTabReload(ProfileScreen, 'profile');

function ProfileScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { show } = useToast();
  const { profile } = useProfile(user?.id);
  const { books, loading, error } = useBooks();
  const { reads, logRead } = useReads();
  const { ratings, ratingFor } = useBookRatings();
  const navBarSpace = useNavBarSpace();

  const editProfileRef = useRef<BottomSheetModal>(null);
  const readRef = useRef<BottomSheetModal>(null);
  // Bumped rather than set: edition the same scope twice has to re-open the
  // sheet, and the counter is what makes the second press a new value.
  const [pickRequest, setPickRequest] = useState<{ scope: 'library' | 'neglected'; nonce: number } | null>(null);

  const stats = useMemo(() => shelfStats(books, ratings), [books, ratings]);
  const recent = useMemo(() => recentlyAdded(books), [books]);
  const playing = useMemo(() => nowPlaying(books, reads), [books, reads]);
  const best = useMemo(() => topRated(books, ratings), [books, ratings]);
  const distribution = useMemo(() => ratingDistribution(ratings), [ratings]);

  // Read once, on mount, rather than on every render: "neglected" is a cutoff,
  // and a clock read during render would make the list impure and re-derive it
  // every pass for no benefit. The screen is remounted on tab reload anyway.
  const [mountedAt] = useState(() => Date.now());

  const started = useMemo(() => books.filter(isStarted), [books]);
  const neglected = useMemo(() => {
    const cutoff = mountedAt - NEGLECTED_DAYS * 86_400_000;
    return started.filter((book) => !book.lastReadAt || Date.parse(book.lastReadAt) < cutoff);
  }, [started, mountedAt]);
  const pickPool = pickRequest?.scope === 'neglected' ? neglected : started;

  // Presented from an effect, not from the press handler: the sheet starts its
  // reel the moment it opens, so the new pool has to be committed as a prop
  // first or the draw is made from whichever scope was picked last.
  useEffect(() => {
    if (pickRequest) readRef.current?.present();
  }, [pickRequest]);

  const openBook = (book: Book) => router.push({ pathname: '/book/[bookId]', params: { bookId: book.id } });
  const ratingsFor = (book: Book) => ratingFor(book.bookKey)?.ratings ?? null;

  const handleLogRead = async (book: Book) => {
    await logRead(book);
    show(`Read logged for ${book.title}`);
  };

  const share = async () => {
    if (!user) return;
    await Clipboard.setStringAsync(publicShelfUrl(user.id));
    show('Public shelf link copied');
  };

  if (loading) {
    return (
      <View className="flex-1 bg-background">
        <ScreenTop />
        <LoadingState label="Loading your shelf…" />
      </View>
    );
  }
  if (error) {
    return (
      <View className="flex-1 bg-background">
        <ScreenTop />
        <ErrorState message={error instanceof Error ? error.message : 'Failed to load your shelf'} />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <ContentShell fill maxWidth={MAX_W.text}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: navBarSpace }}>
          <MyShelfHeader
            profile={profile}
            email={user?.email}
            stats={stats}
            backdropUrl={playing[0]?.coverUrl ?? recent[0]?.coverUrl ?? null}
            onEdit={() => editProfileRef.current?.present()}
            onShare={share}
          />

          <ShelfSections
            topRated={best}
            nowPlaying={playing}
            recent={recent}
            ratingsFor={ratingsFor}
            onOpenBook={openBook}
            onLogRead={handleLogRead}
            belowTopRated={
              <View className="gap-6">
                <ReadPromptCard
                  libraryCount={started.length}
                  neglectedCount={neglected.length}
                  onPick={(scope) => setPickRequest((previous) => ({ scope, nonce: (previous?.nonce ?? 0) + 1 }))}
                />
                {/* Under the picker: the picker is a prompt about tonight, the
                    curve is a read on everything you have ever scored. */}
                <View className="mx-4 rounded-2xl border border-border bg-card/50 p-5">
                  <RatingCurve distribution={distribution} />
                </View>
              </View>
            }
            belowNowPlaying={
              <Pressable
                onPress={() => router.push('/history')}
                className="mx-4 flex-row items-center gap-3 rounded-2xl border border-border bg-card/50 p-4 active:opacity-80"
              >
                <Clock size={18} color={COLORS.accent} />
                <View className="min-w-0 flex-1">
                  <Text className="text-sm font-semibold text-foreground">Reading history</Text>
                  <Text className="text-xs text-muted-foreground">
                    {reads.length === 0 ? 'Nothing logged yet' : `${reads.length} reads logged`}
                  </Text>
                </View>
              </Pressable>
            }
          />
        </ScrollView>
      </ContentShell>

      {/* Both sheets are mounted here rather than inside the scrolling body: a
          sheet declared in that subtree cannot scroll its own content, because
          the surrounding ScrollView wins the pan gesture. */}
      <EditProfileSheet ref={editProfileRef} />
      <RandomReadSheet
        ref={readRef}
        books={pickPool}
        ratingsFor={ratingsFor}
        onSelect={(book) => {
          readRef.current?.dismiss();
          openBook(book);
        }}
        onLogRead={async (book) => {
          await handleLogRead(book);
          readRef.current?.dismiss();
        }}
      />
    </View>
  );
}
