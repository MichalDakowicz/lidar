import { Text, View } from 'react-native';

/**
 * A favourite-subject chip. Rank drives the emphasis, so the shape of someone's
 * taste is legible at a glance instead of needing the numbers read.
 *
 * Radar's chip carries a genre icon and taps through to a TMDB genre page.
 * Lidar has neither — Google Books' categories are free text with no ids behind
 * them — so this is the chip without the tap.
 */
export type GenreRank = 'top' | 'high' | 'mid' | 'low';

const RANK_STYLES: Record<GenreRank, string> = {
  top: 'border-muted-foreground bg-secondary',
  high: 'border-border',
  mid: 'border-border/60',
  low: 'border-border/30',
};

const RANK_TEXT: Record<GenreRank, string> = {
  top: 'text-foreground',
  high: 'text-foreground/90',
  mid: 'text-muted-foreground',
  low: 'text-muted-foreground/60',
};

export function rankFor(index: number): GenreRank {
  if (index <= 1) return 'top';
  if (index <= 3) return 'high';
  if (index < 6) return 'mid';
  return 'low';
}

export function GenreTag({ name, count, rank }: { name: string; count: number; rank: GenreRank }) {
  return (
    <View className={`flex-row items-center gap-2 rounded-full border px-4 py-2.5 ${RANK_STYLES[rank]}`}>
      <Text className={`text-sm font-medium ${RANK_TEXT[rank]}`}>{name}</Text>
      <View className="h-1 w-1 rounded-full bg-muted-foreground/40" />
      <Text className={`text-xs font-semibold ${RANK_TEXT[rank]}`} style={{ opacity: 0.7 }}>
        {count}
      </Text>
    </View>
  );
}
