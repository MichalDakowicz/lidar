import type { FlashListRef } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { ContentShell } from '@/components/layout/ContentShell';
import { ScreenTop } from '@/components/layout/ScreenTop';
import { BookGrid } from '@/components/media/BookGrid';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { LoadingState } from '@/components/ui/LoadingState';
import type { BottomSheetModal } from '@/components/ui/Sheet';
import { useToast } from '@/components/ui/Toast';
import { LibraryFilterSheet } from '@/features/library/LibraryFilterSheet';
import { LibraryGroups } from '@/features/library/LibraryGroups';
import { LibrarySection } from '@/features/library/LibrarySection';
import { LibraryToolbar } from '@/features/library/LibraryToolbar';
import { GroupingSheet } from '@/features/library/GroupingSheet';
import { useLibraryFilters } from '@/features/library/useLibraryFilters';
import { useBookRatings } from '@/hooks/useBookRatings';
import { useBooks } from '@/hooks/useBooks';
import { useNavBarSpace } from '@/hooks/useNavBarSpace';
import { MAX_W } from '@/hooks/useResponsive';
import { useScrollToTopOnChange } from '@/hooks/useScrollToTopOnChange';
import { useReads } from '@/hooks/useReads';
import { useLibraryPrefs } from '@/store/libraryPrefs';
import { withTabReload } from '@/store/tabReload';
import type { Book } from '@/types/book';

/**
 * Your shelf. A thin composition layer: all derive logic lives in
 * useLibraryFilters, all durable prefs in the zustand+MMKV store, all
 * rendering in the Library* components.
 *
 * Double-tapping the tab is "give me my library back", so it clears the
 * persisted filters as well as the remount-scoped state (search, scroll). View
 * mode, card size, grouping and sort are deliberately left alone: those are how
 * you like to look at the shelf, not a narrowing you need undone.
 */
export default withTabReload(LibraryScreen, 'index', () => useLibraryPrefs.getState().resetFilters());

function LibraryScreen() {
  const router = useRouter();
  const { show } = useToast();
  const { books, loading, error } = useBooks();
  const { logRead } = useReads();
  const { ratingFor, scoreFor } = useBookRatings();
  const navBarSpace = useNavBarSpace();
  const [searchQuery, setSearchQuery] = useState('');

  const prefs = useLibraryPrefs();
  const filters = useLibraryFilters({
    books,
    searchQuery,
    statusFilter: prefs.statusFilter,
    selectedAuthors: prefs.selectedAuthors,
    selectedGenres: prefs.selectedGenres,
    selectedYears: prefs.selectedYears,
    sortBy: prefs.sortBy,
    sortDir: prefs.sortDir,
    groupBy: prefs.groupBy,
    scoreFor: useCallback((book: Book) => scoreFor(book.bookKey) ?? 0, [scoreFor]),
  });

  // Searching, filtering or re-sorting replaces what the list is showing, so it
  // goes back to the top instead of leaving the user parked at an offset that
  // now points into the middle of a different result set.
  const listRef = useScrollToTopOnChange<FlashListRef<Book>>(
    [
      searchQuery,
      prefs.statusFilter,
      prefs.sortBy,
      prefs.sortDir,
      prefs.groupBy,
      prefs.selectedAuthors,
      prefs.selectedGenres,
      prefs.selectedYears,
    ]
      .map((part) => (Array.isArray(part) ? part.join(',') : part))
      .join('|'),
  );

  const filterSheetRef = useRef<BottomSheetModal>(null);
  const groupingSheetRef = useRef<BottomSheetModal>(null);

  const openBook = (book: Book) => router.push({ pathname: '/book/[bookId]', params: { bookId: book.id } });
  const ratingsFor = (book: Book) => ratingFor(book.bookKey)?.ratings ?? null;

  const handleLogRead = async (book: Book) => {
    try {
      await logRead(book);
      show(`Read logged for ${book.title}`);
    } catch (readError) {
      show(readError instanceof Error ? readError.message : 'Could not log that read');
    }
  };

  if (loading) {
    return (
      <View className="flex-1 bg-background">
        <ScreenTop />
        <LoadingState label="Loading your library…" />
      </View>
    );
  }
  if (error) {
    return (
      <View className="flex-1 bg-background">
        <ScreenTop />
        <ErrorState message={error instanceof Error ? error.message : 'Failed to load your library'} />
      </View>
    );
  }

  const sections = (
    <>
      <LibrarySection
        title="Readlist"
        books={filters.readlist}
        ratingsFor={ratingsFor}
        onPress={openBook}
        variant="cover"
        collapsible
        collapsed={prefs.readlistCollapsed}
        onToggleCollapse={prefs.toggleReadlistCollapsed}
      />
    </>
  );

  const emptyState =
    books.length === 0 ? (
      <EmptyState title="Your shelf is empty" description="Tap + in the nav bar to add your first book." />
    ) : (
      <EmptyState title="Nothing matches" description="Loosen a filter or clear the search to see the rest." />
    );

  return (
    <View className="flex-1 bg-background">
      <ScreenTop />
      <ContentShell maxWidth={MAX_W.grid}>
        <LibraryToolbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onOpenFilters={() => filterSheetRef.current?.present()}
          onOpenGrouping={() => groupingSheetRef.current?.present()}
        />
      </ContentShell>

      <ContentShell fill maxWidth={MAX_W.grid}>
        {filters.groups ? (
          // Grouped: one scroll view of buckets. The virtualized path below is
          // what carries a large ungrouped shelf.
          <ScrollView contentContainerStyle={{ paddingBottom: navBarSpace + 16 }} showsVerticalScrollIndicator={false}>
            {sections}
            <LibraryGroups
              groups={filters.groups}
              viewMode={prefs.viewMode}
              gridSize={prefs.gridSize}
              ratingsFor={ratingsFor}
              onPress={openBook}
              onLogRead={handleLogRead}
            />
          </ScrollView>
        ) : (
          <BookGrid
            listRef={listRef}
            books={filters.mainBooks}
            variant={prefs.viewMode === 'list' ? 'row' : 'cover'}
            size={prefs.gridSize}
            ratingsFor={ratingsFor}
            onPress={openBook}
            onLogRead={handleLogRead}
            ListHeaderComponent={sections}
            ListEmptyComponent={emptyState}
          />
        )}
      </ContentShell>

      <LibraryFilterSheet ref={filterSheetRef} />
      <GroupingSheet ref={groupingSheetRef} />
    </View>
  );
}
