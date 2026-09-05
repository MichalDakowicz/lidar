import { useLocalSearchParams, useRouter } from 'expo-router';
import { Lock, Search } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { ContentShell } from '@/components/layout/ContentShell';
import { BookGrid } from '@/components/media/BookGrid';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { LoadingState } from '@/components/ui/LoadingState';
import { SearchInput } from '@/components/ui/SearchInput';
import { usePublicRatings } from '@/hooks/useBookRatings';
import { useCanViewUser, usePublicBooks } from '@/hooks/usePublicBooks';
import { MAX_W } from '@/hooks/useResponsive';
import { bookMatchesSearchQuery } from '@/lib/librarySearch';
import { COLORS } from '@/theme/colors';
import type { Book } from '@/types/book';

/**
 * Someone's library, read-only. Rendered through the same BookGrid and
 * BookCard as your own shelf, in `readOnly` mode — there is no second copy of
 * the card for public pages, which is how the legacy app ended up with a shelf
 * that looked subtly different from the library.
 *
 * Visibility is enforced by RLS; `can_view_user` is only used to tell a private
 * shelf apart from an empty one.
 */
export default function PublicLibrary() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const router = useRouter();
  const { canView, loading: viewLoading } = useCanViewUser(userId);
  const { books, loading, error } = usePublicBooks(canView ? userId : undefined);
  const { ratingFor } = usePublicRatings(canView ? userId : undefined);
  const [search, setSearch] = useState('');

  const filtered = useMemo(
    () => (search.trim() ? books.filter((book) => bookMatchesSearchQuery(book, search)) : books),
    [books, search],
  );

  // Tapping through goes to the release, not to their row: their book id means
  // nothing on your account, and the release page is where you can rate it.
  const openRelease = (book: Book) =>
    router.push({ pathname: '/release/[bookKey]', params: { bookKey: book.bookKey } });

  if (viewLoading || (canView && loading)) {
    return (
      <View className="flex-1 bg-background">
        <LoadingState label="Loading shelf…" />
      </View>
    );
  }

  if (canView === false) {
    return (
      <View className="flex-1 bg-background">
        <EmptyState
          icon={<Lock size={40} color={COLORS.mutedDeep} />}
          title="This shelf is private"
          description="Only friends can browse this library."
        />
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 bg-background">
        <ErrorState message={error instanceof Error ? error.message : 'Failed to load shelf'} />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <View className="flex-row items-center gap-2 border-b border-border px-4 py-3">
        <Search size={18} color={COLORS.muted} />
        <SearchInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search this library…"
          placeholderTextColor={COLORS.muted}
          className="flex-1 text-foreground"
        />
      </View>

      <ContentShell fill maxWidth={MAX_W.grid}>
        <BookGrid
          books={filtered}
          size="normal"
          variant="cover"
          ratingsFor={(book) => ratingFor(book.bookKey)?.ratings ?? null}
          onPress={openRelease}
          readOnly
          // The public shelf has no floating nav — it uses a plain tab bar — so
          // the grid must not reserve space for one.
          padForNavBar={false}
          ListEmptyComponent={<EmptyState title="Nothing here yet" description="This library is empty." />}
        />
      </ContentShell>
    </View>
  );
}
