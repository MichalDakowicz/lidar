import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { Music, Trash2 } from 'lucide-react-native';
import { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';

import { ContentShell } from '@/components/layout/ContentShell';
import { NavIslands } from '@/components/layout/NavIslands';
import { CoverImage } from '@/components/media/CoverImage';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { useToast } from '@/components/ui/Toast';
import { NestedHeader } from '@/features/social/NestedHeader';
import { useNavBarSpace } from '@/hooks/useNavBarSpace';
import { MAX_W } from '@/hooks/useResponsive';
import { useReads } from '@/hooks/useReads';
import { authorsToDisplayString, formatRelativeTime } from '@/lib/utils';
import { COLORS } from '@/theme/colors';
import type { Read } from '@/types/book';

/**
 * Every listen you have logged, newest first.
 *
 * This log is the source of truth for "last played" everywhere else, so
 * deleting a mistaken read here is what corrects the card, the shelf sort and
 * the stats — useReads re-derives the book's mirror from what is left.
 */
export default function History() {
  const router = useRouter();
  const { reads, loading, removeRead } = useReads();
  const { show } = useToast();
  const navBarSpace = useNavBarSpace();

  // Day headers are cheap here and make a long log readable, so the list is fed
  // a flat array of rows and separators rather than nested sections.
  const rows = useMemo(() => withDayHeaders(reads), [reads]);

  const remove = async (read: Read) => {
    try {
      await removeRead(read.id);
      show('Read removed');
    } catch (error) {
      show(error instanceof Error ? error.message : 'Could not remove that read');
    }
  };

  return (
    <View className="flex-1 bg-background">
      <NestedHeader title="Listening history" />

      <ContentShell fill maxWidth={MAX_W.text}>
        {loading ? (
          <LoadingState label="Loading your history…" />
        ) : reads.length === 0 ? (
          <EmptyState
            icon={<Music size={40} color={COLORS.mutedDeep} />}
            title="Nothing logged yet"
            description="Press play on a record's card, or open it and log a read."
          />
        ) : (
          <FlashList
            data={rows}
            keyExtractor={(item) => (item.kind === 'header' ? `h-${item.label}` : item.read.id)}
            contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: navBarSpace + 16 }}
            renderItem={({ item }) =>
              item.kind === 'header' ? (
                <Text className="px-1 pb-2 pt-4 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  {item.label}
                </Text>
              ) : (
                <Pressable
                  onPress={() =>
                    item.read.bookId
                      ? router.push({ pathname: '/book/[bookId]', params: { bookId: item.read.bookId } })
                      : undefined
                  }
                  className="mb-2 flex-row items-center gap-3 rounded-xl border border-border bg-card/50 p-3 active:opacity-80"
                >
                  <View className="h-12 w-12 overflow-hidden rounded-md bg-secondary">
                    <CoverImage uri={item.read.coverUrl} iconSize={16} />
                  </View>
                  <View className="min-w-0 flex-1">
                    <Text numberOfLines={1} className="text-sm font-semibold text-foreground">
                      {item.read.title}
                    </Text>
                    <Text numberOfLines={1} className="text-xs text-muted-foreground">
                      {authorsToDisplayString(item.read.authors)}
                    </Text>
                  </View>
                  <View className="items-end gap-0.5">
                    <Text className="text-xs text-muted-foreground">{formatRelativeTime(item.read.finishedAt)}</Text>
                    <Text className="text-[11px] text-muted-foreground/60">
                      {new Date(item.read.finishedAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => remove(item.read)}
                    accessibilityLabel={`Remove the ${item.read.title} read`}
                    hitSlop={8}
                    className="rounded-full p-2 active:opacity-70"
                  >
                    <Trash2 size={15} color={COLORS.muted} />
                  </Pressable>
                </Pressable>
              )
            }
          />
        )}
      </ContentShell>

      <NavIslands />
    </View>
  );
}

type Row = { kind: 'header'; label: string } | { kind: 'read'; read: Read };

/** Groups an already newest-first log under Today / Yesterday / a date. */
function withDayHeaders(reads: Read[]): Row[] {
  const rows: Row[] = [];
  let current = '';

  for (const read of reads) {
    const label = dayLabel(read.finishedAt);
    if (label !== current) {
      current = label;
      rows.push({ kind: 'header', label });
    }
    rows.push({ kind: 'read', read });
  }

  return rows;
}

function dayLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (sameDay(date, today)) return 'Today';
  if (sameDay(date, yesterday)) return 'Yesterday';
  return date.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
}
