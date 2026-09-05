import { forwardRef, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { Sheet, type BottomSheetModal } from '@/components/ui/Sheet';
import { ChoiceRow, FacetFilterRow } from '@/features/library/FacetFilterRow';
import { useBooks } from '@/hooks/useBooks';
import { libraryFacets } from '@/lib/libraryFacets';
import { SORT_OPTIONS } from '@/lib/librarySort';
import { useLibraryPrefs, type StatusFilter } from '@/store/libraryPrefs';

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'Readlist', label: 'Readlist' },
  { value: 'Reading', label: 'Reading' },
  { value: 'Read', label: 'Read' },
];

/**
 * Every way to narrow the library, in one sheet: status, author, genre, year,
 * then sort. The legacy web app spread these across a popover, a
 * combobox and a second popover; as one sheet they narrow the single
 * virtualized grid instead of re-bucketing it.
 */
export const LibraryFilterSheet = forwardRef<BottomSheetModal>(function LibraryFilterSheet(_props, ref) {
  const prefs = useLibraryPrefs();
  const { books } = useBooks();
  const facets = useMemo(() => libraryFacets(books), [books]);
  // Chips plus labels come to a fixed height, so the sheet is sized to what it
  // measures rather than to a fraction of the screen. The snap point stays as
  // the ceiling for narrow screens where the chips wrap onto more rows, and the
  // starting estimate keeps the first open from visibly resizing once measured.
  const [contentHeight, setContentHeight] = useState(410);

  return (
    <Sheet ref={ref} snapPoints={['80%']} contentHeight={contentHeight}>
      <ScrollView contentContainerClassName="gap-6 p-4" onContentSizeChange={(_width, height) => setContentHeight(height)}>
        <View className="flex-row items-center justify-between">
          <Text className="text-lg font-bold text-foreground">Filter &amp; Sort</Text>
          <Pressable onPress={prefs.resetFilters} hitSlop={8}>
            <Text className="text-sm text-muted-foreground">Clear all</Text>
          </Pressable>
        </View>

        <ChoiceRow title="Status" options={STATUS_OPTIONS} value={prefs.statusFilter} onChange={prefs.setStatusFilter} />

        <FacetFilterRow
          title="Author"
          facets={facets.authors}
          selected={prefs.selectedAuthors}
          onToggle={prefs.toggleAuthor}
          searchPlaceholder="Search authors…"
        />

        <FacetFilterRow title="Genre" facets={facets.genres} selected={prefs.selectedGenres} onToggle={prefs.toggleGenre} />

        <FacetFilterRow title="Release year" facets={facets.years} selected={prefs.selectedYears} onToggle={prefs.toggleYear} />

        <ChoiceRow title="Sort by" options={SORT_OPTIONS} value={prefs.sortBy} onChange={prefs.setSortBy} />
      </ScrollView>
    </Sheet>
  );
});
