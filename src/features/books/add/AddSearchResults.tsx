import { Image } from 'expo-image';
import { BookOpen, Check, Plus } from 'lucide-react-native';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { EmptyState } from '@/components/ui/EmptyState';
import type { BookResult } from '@/lib/googleBooks';
import { authorsToDisplayString, publishedYear } from '@/lib/utils';
import { COLORS } from '@/theme/colors';

type AddSearchResultsProps = {
  results: BookResult[];
  loading: boolean;
  query: string;
  isAdded: (bookKey: string) => boolean;
  pendingKey: string | null;
  onSelect: (found: BookResult) => void;
  onAdd: (found: BookResult) => void;
};

/**
 * Search hits as pickable rows. Tapping the row opens the book page (where it
 * can be rated whether or not it is owned); tapping the + puts it straight on
 * the shelf with the draft's status and formats.
 *
 * There is no "search is not configured" state here as there is in Sonar's
 * equivalent: Google Books and Open Library both answer without credentials.
 */
export function AddSearchResults({
  results,
  loading,
  query,
  isAdded,
  pendingKey,
  onSelect,
  onAdd,
}: AddSearchResultsProps) {
  if (loading && results.length === 0) {
    return (
      <View className="items-center py-10">
        <ActivityIndicator color={COLORS.accent} />
      </View>
    );
  }

  if (query.trim().length > 1 && results.length === 0) {
    return (
      <EmptyState
        icon={<BookOpen size={36} color={COLORS.mutedDeep} />}
        title="No books found"
        description="Check the spelling, scan the barcode, or add it by hand."
      />
    );
  }

  return (
    <View className="gap-2">
      {results.map((found) => {
        const added = isAdded(found.bookKey);
        const pending = pendingKey === found.bookKey;
        return (
          <Pressable
            key={found.bookKey}
            onPress={() => onSelect(found)}
            className="flex-row items-center gap-3 rounded-xl border border-border bg-card p-2.5 active:opacity-80"
          >
            {/* 2:3 rather than the square a record sleeve gets — a jacket
                cropped to a square loses the title on most covers. */}
            <View className="h-[76px] w-[52px] overflow-hidden rounded-md bg-secondary">
              {found.coverUrl ? (
                <Image source={{ uri: found.coverUrl }} style={{ width: 52, height: 76 }} contentFit="cover" transition={120} />
              ) : (
                <View className="h-full w-full items-center justify-center">
                  <BookOpen size={20} color={COLORS.mutedDeep} />
                </View>
              )}
            </View>

            <View className="min-w-0 flex-1">
              <Text numberOfLines={2} className="text-sm font-bold text-foreground">
                {found.title}
              </Text>
              <Text numberOfLines={1} className="text-xs text-muted-foreground">
                {authorsToDisplayString(found.authors)}
              </Text>
              <Text numberOfLines={1} className="text-[11px] text-muted-foreground/80">
                {[publishedYear(found.publishedDate), found.publisher, found.pageCount ? `${found.pageCount}pp` : '']
                  .filter(Boolean)
                  .join(' • ')}
              </Text>
            </View>

            <Pressable
              onPress={() => (added ? undefined : onAdd(found))}
              disabled={added || pending}
              accessibilityLabel={added ? `${found.title} is already on your shelf` : `Add ${found.title}`}
              hitSlop={8}
              className="rounded-full p-2.5"
              style={{ backgroundColor: COLORS.accentSoft }}
            >
              {pending ? (
                <ActivityIndicator size="small" color={COLORS.accent} />
              ) : added ? (
                <Check size={16} color={COLORS.accent} />
              ) : (
                <Plus size={16} color={COLORS.accent} />
              )}
            </Pressable>
          </Pressable>
        );
      })}
    </View>
  );
}
