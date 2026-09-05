import { Search, Star } from 'lucide-react-native';
import { useMemo, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { ContentShell } from '@/components/layout/ContentShell';
import { ScreenTop } from '@/components/layout/ScreenTop';
import { RatingCurve } from '@/components/stats/RatingCurve';
import { EmptyState } from '@/components/ui/EmptyState';
import { SearchInput } from '@/components/ui/SearchInput';
import type { BottomSheetModal } from '@/components/ui/Sheet';
import { useBookSearch } from '@/features/books/add/useBookSearch';
import { DropSheet } from '@/features/ratings/DropSheet';
import { RatingSearchRow, SearchSpinner } from '@/features/ratings/RatingSearchRow';
import { TierBoard } from '@/features/ratings/TierBoard';
import { UnratedRail } from '@/features/ratings/UnratedRail';
import { useBookRatings, type RateTarget } from '@/hooks/useBookRatings';
import { useBooks } from '@/hooks/useBooks';
import { useNavBarSpace } from '@/hooks/useNavBarSpace';
import { MAX_W, useIsDesktop } from '@/hooks/useResponsive';
import { useSearchFocusRegistration } from '@/hooks/useSearchFocusRegistration';
import { ratingDistribution } from '@/lib/ratingDistribution';
import { COLORS } from '@/theme/colors';
import { withTabReload } from '@/store/tabReload';

/**
 * The ratings page: a tier list of everything you have an opinion about, and a
 * search box that will pull in any release on Google Books so you can have one.
 *
 * Nothing here touches the library. Rating is not owning — the whole reason
 * ratings live in their own table, keyed by release with no FK to `books`
 * (hooks/useBookRatings) — so a record you streamed once, a friend's copy and
 * something you sold years ago all belong on this board. This replaced a
 * discovery feed, which Google Books itself does better.
 */
export default withTabReload(RatingsScreen, 'ratings');

function RatingsScreen() {
  const isDesktop = useIsDesktop();
  const navBarSpace = useNavBarSpace();
  const searchRef = useSearchFocusRegistration();
  const [term, setTerm] = useState('');
  const [target, setTarget] = useState<RateTarget | null>(null);
  const dropRef = useRef<BottomSheetModal>(null);

  const { ratings, ratingFor } = useBookRatings();
  const { books } = useBooks();
  const search = useBookSearch(term);
  const searching = term.trim().length > 1;

  const distribution = useMemo(() => ratingDistribution(ratings), [ratings]);

  const open = (next: RateTarget) => {
    setTarget(next);
    dropRef.current?.present();
  };

  return (
    <View className="flex-1 bg-background">
      <ScreenTop />

      <ContentShell maxWidth={MAX_W.detail}>
        <View className={isDesktop ? 'px-8 pb-4 pt-2' : 'px-4 pb-3 pt-1'}>
          <View className="relative">
            <View className="absolute bottom-0 left-3 top-0 z-10 justify-center">
              <Search size={18} color={COLORS.muted} />
            </View>
            <SearchInput
              ref={searchRef}
              value={term}
              onChangeText={setTerm}
              placeholder={isDesktop ? 'Rate anything — book, author or a link    /' : 'Rate anything — book, author or a link'}
              placeholderTextColor={COLORS.muted}
              autoCapitalize="none"
              autoCorrect={false}
              className="h-11 w-full rounded-lg border border-border bg-secondary pl-10 pr-4 text-foreground"
            />
          </View>
        </View>
      </ContentShell>

      <ContentShell fill maxWidth={MAX_W.detail}>
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: navBarSpace + 24 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {searching ? (
            <View className="gap-2 px-4">
              {search.loading && search.results.length === 0 ? (
                <SearchSpinner />
              ) : search.results.length === 0 ? (
                <EmptyState title="Nothing found" description="Check the spelling, or search by ISBN." />
              ) : (
                search.results.map((release) => (
                  <RatingSearchRow
                    key={release.googleId}
                    release={release}
                    ratings={ratingFor(release.bookKey)?.ratings ?? null}
                    onPress={() =>
                      open({
                        bookKey: release.bookKey,
                        isbn13: release.isbn13,
                        title: release.title,
                        authors: release.authors,
                        coverUrl: release.coverUrl,
                        publishedDate: release.publishedDate,
                      })
                    }
                  />
                ))
              )}
            </View>
          ) : (
            <View className="gap-6">
              <UnratedRail books={books} ratingFor={ratingFor} onPick={open} />

              {ratings.length === 0 ? (
                <EmptyState
                  icon={<Star size={40} color={COLORS.mutedDeep} />}
                  title="Nothing rated yet"
                  description="Search for anything you have heard — owning it is not the point — and drop it into a tier."
                />
              ) : (
                <>
                  <TierBoard ratings={ratings} onPick={(rating) => open(rating)} onSearch={() => searchRef.current?.focus()} />
                  <View className="mx-4 rounded-2xl border border-border bg-card/50 p-5">
                    <RatingCurve distribution={distribution} />
                  </View>
                  <Text className="px-4 text-[11px] text-muted-foreground">
                    A tier is read from the score, not stored beside it — so the board, the stats and a
                    friend&apos;s view can never disagree about what you think of a record.
                  </Text>
                </>
              )}
            </View>
          )}
        </ScrollView>
      </ContentShell>

      {/* Mounted outside the scroll view: a sheet inside it cannot win the pan
          gesture from its own parent. */}
      <DropSheet ref={dropRef} target={target} onDismiss={() => setTarget(null)} />
    </View>
  );
}
