import { Text, View } from 'react-native';

/**
 * One "most read author" row: initials, name, pages, and a bar relative to the
 * author you have read most.
 *
 * Radar's equivalent fetches a director's headshot from TMDB. Google Books has
 * no author images, so the initials disc is the whole avatar — which is also
 * why the bar carries the weight here.
 */
type AuthorItemProps = {
  name: string;
  pages: number;
  books: number;
  max: number;
};

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export function AuthorItem({ name, pages, books, max }: AuthorItemProps) {
  const percent = max > 0 ? Math.min(100, (pages / max) * 100) : 0;

  return (
    <View className="flex-row items-center gap-4 py-3">
      <View className="h-12 w-12 items-center justify-center rounded-full border border-border bg-secondary">
        <Text className="text-sm font-bold text-muted-foreground">{initialsOf(name)}</Text>
      </View>

      <View className="flex-1 gap-2">
        <View className="flex-row items-end justify-between gap-3">
          <Text numberOfLines={1} className="min-w-0 flex-1 text-base font-semibold text-foreground">
            {name}
          </Text>
          <Text className="text-sm font-medium text-muted-foreground">
            {pages.toLocaleString()}{' '}
            <Text className="text-xs uppercase tracking-wider text-muted-foreground/70">
              pages · {books} {books === 1 ? 'book' : 'books'}
            </Text>
          </Text>
        </View>
        <View className="h-1 w-full overflow-hidden rounded-full bg-secondary">
          <View className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
        </View>
      </View>
    </View>
  );
}
