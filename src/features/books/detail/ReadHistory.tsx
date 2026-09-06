import { Trash2 } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

import { formatRelativeTime } from '@/lib/utils';
import { COLORS } from '@/theme/colors';
import type { Read } from '@/types/book';

type ReadHistoryProps = {
  reads: Read[];
  /** Finishes with no date on them — counted here, but not listable. */
  undated?: number;
  onRemoveRead?: (readId: string) => void;
  /** Someone else's shelf: their finishes are shown, nothing is editable. */
  readOnly?: boolean;
};

const VISIBLE = 8;

/**
 * Every time you have finished this book, with the day it happened on. The log
 * is the source of truth for "last read" everywhere else in the app, so
 * removing a mistaken entry here is what corrects the card, the sort and the
 * stats.
 *
 * Logging a finish is the times-finished box above, not a button here: two
 * places to record the same thing is how a log gains a duplicate.
 */
export function ReadHistory({ reads, undated = 0, onRemoveRead, readOnly }: ReadHistoryProps) {
  const shown = reads.slice(0, VISIBLE);

  return (
    <View className="gap-3">
      <View className="flex-row items-center justify-between">
        <Text className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
          Finishes {reads.length > 0 ? `(${reads.length})` : ''}
        </Text>
        {undated > 0 && (
          <Text className="text-[11px] text-muted-foreground">
            +{undated} with no date
          </Text>
        )}
      </View>

      {shown.length === 0 ? (
        <Text className="text-xs text-muted-foreground">
          {readOnly
            ? 'No finishes logged.'
            : undated > 0
              ? 'Nothing dated yet — the finishes above have no day attached.'
              : 'Nothing logged yet — press Finished when you close the back cover.'}
        </Text>
      ) : (
        <View className="gap-1.5">
          {shown.map((read) => (
            <View key={read.id} className="flex-row items-center gap-3 rounded-lg bg-secondary/50 px-3 py-2">
              <View className="min-w-0 flex-1">
                <Text className="text-sm text-foreground">{formatRelativeTime(read.finishedAt)}</Text>
                <Text className="text-[11px] text-muted-foreground">
                  {new Date(read.finishedAt).toLocaleString(undefined, {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                  {read.pageCount ? ` · ${read.pageCount.toLocaleString()} pages` : ''}
                </Text>
              </View>
              {!readOnly && !!onRemoveRead && (
                <Pressable
                  onPress={() => onRemoveRead(read.id)}
                  accessibilityLabel="Remove this finish"
                  hitSlop={8}
                  className="rounded-full p-2 active:opacity-70"
                >
                  <Trash2 size={14} color={COLORS.muted} />
                </Pressable>
              )}
            </View>
          ))}
          {reads.length > VISIBLE && (
            <Text className="px-1 pt-1 text-[11px] text-muted-foreground">
              +{reads.length - VISIBLE} older — the full log lives on the History screen
            </Text>
          )}
        </View>
      )}
    </View>
  );
}
