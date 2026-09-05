import type { FlashListRef } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { ContentShell } from '@/components/layout/ContentShell';
import { ScreenTop } from '@/components/layout/ScreenTop';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { LoadingState } from '@/components/ui/LoadingState';
import { useToast } from '@/components/ui/Toast';
import { useBookSearch } from '@/features/books/add/useBookSearch';
import { useQuickAdd } from '@/features/books/add/useQuickAdd';
import { BrowseSearchBar } from '@/features/browse/BrowseSearchBar';
import { DiscoveryRow } from '@/features/browse/DiscoveryRow';
import { SearchResultsGrid } from '@/features/browse/SearchResultsGrid';
import { fromDiscoveryBook, toDiscoveryBook } from '@/features/browse/toDiscoveryBook';
import { useDiscoveryFeed } from '@/features/browse/useDiscoveryFeed';
import { useBookRatings } from '@/hooks/useBookRatings';
import { useNavBarSpace } from '@/hooks/useNavBarSpace';
import { MAX_W } from '@/hooks/useResponsive';
import { useScrollToTopOnChange } from '@/hooks/useScrollToTopOnChange';
import { withTabReload } from '@/store/tabReload';
import type { Book } from '@/types/book';

/**
 * Browse: find a book that is not on your shelf yet.
 *
 * A thin composition layer — the rows are decided in `discoveryRowSpecs`,
 * fetched in `useDiscoveryFeed`, and written through `useQuickAdd`.
 *
 * **This is not a trending feed and does not pretend to be one.** Radar's
 * Browse rides TMDB's curated charts; Google Books publishes nothing of the
 * kind. So the search field is the primary affordance and the rows underneath
 * are built out of what this reader has actually read — see the note in
 * `discoveryRows.ts`.
 */
export default withTabReload(BrowseScreen, 'browse');

function BrowseScreen() {
  const router = useRouter();
  const { show } = useToast();
  const [term, setTerm] = useState('');
  const navBarSpace = useNavBarSpace();

  const quickAdd = useQuickAdd();
  const { ratingFor } = useBookRatings();
  const search = useBookSearch(term);
  const feed = useDiscoveryFeed(quickAdd.books);

  const searching = term.trim().length > 1;
  const results = useMemo(() => search.results.map(toDiscoveryBook), [search.results]);

  // A new query replaces the grid's contents, so it starts at the top rather
  // than keeping the previous search's offset.
  const searchListRef = useScrollToTopOnChange<FlashListRef<Book>>(term.trim());

  const ratingsFor = (book: Book) => ratingFor(book.bookKey)?.ratings ?? null;
  const isAdded = (book: Book) => quickAdd.isAdded(book.bookKey);

  const handleAdd = async (book: Book) => {
    try {
      const added = await quickAdd.add(fromDiscoveryBook(book));
      if (added) show(`${added.title} added to your readlist`);
    } catch (error) {
      show(error instanceof Error ? error.message : 'Could not add that book');
    }
  };

  // A book already on the shelf opens its own row; anything else opens the
  // edition page, which can render and be rated with no row behind it.
  const openBook = (book: Book) => {
    const onShelf = quickAdd.findByKey(book.bookKey);
    if (onShelf) router.push({ pathname: '/book/[bookId]', params: { bookId: onShelf.id } });
    else router.push({ pathname: '/edition/[bookKey]', params: { bookKey: book.bookKey } });
  };

  return (
    <View className="flex-1 bg-background">
      <ScreenTop />

      <ContentShell maxWidth={MAX_W.grid}>
        <BrowseSearchBar value={term} onChange={setTerm} loading={search.loading} />
      </ContentShell>

      <ContentShell fill maxWidth={MAX_W.grid}>
        {searching ? (
          <SearchResultsGrid
            listRef={searchListRef}
            results={results}
            loading={search.loading}
            ratingsFor={ratingsFor}
            onPress={openBook}
            onAdd={handleAdd}
            isAdded={isAdded}
          />
        ) : feed.loading && feed.rows.length === 0 ? (
          <LoadingState label="Building your rows…" />
        ) : feed.failed ? (
          <ErrorState message="Could not reach Google Books" onRetry={feed.refetch} />
        ) : feed.rows.length === 0 ? (
          <EmptyState
            title="Nothing to suggest yet"
            description="Search for a book above — once a few are on your shelf, rows show up here."
          />
        ) : (
          <ScrollView
            contentContainerClassName="gap-8 pt-2"
            contentContainerStyle={{ paddingBottom: navBarSpace + 16 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {feed.rows.map((row) => (
              <DiscoveryRow
                key={row.id}
                title={row.title}
                books={row.books}
                onPress={openBook}
                onAdd={handleAdd}
                isAdded={isAdded}
              />
            ))}
          </ScrollView>
        )}
      </ContentShell>
    </View>
  );
}
