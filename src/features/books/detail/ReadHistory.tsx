import { Play, Trash2 } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

import { formatRelativeTime } from '@/lib/utils';
import { COLORS } from '@/theme/colors';
import type { Read } from '@/types/book';

type ReadHistoryProps = {
  reads: Read[];
  onLogRead: () => void;
  onRemoveRead?: (readId: string) => void;
  /** Someone else's shelf: their plays are shown, nothing is editable. */
  readOnly?: boolean;
};

const VISIBLE = 8;

/**
 * Every time you have put this record on. The log is the source of truth for
 * "last finished" everywhere else in the app, so removing a mistaken read here
 * is what corrects the card, the sort and the stats.
 */
export function ReadHistory({ reads, onLogRead, onRemoveRead, readOnly }: ReadHistoryProps) {
  const shown = reads.slice(0, VISIBLE);

  return (
    <View className="gap-3">
      <View className="flex-row items-center justify-between">
        <Text className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
          Reads {reads.length > 0 ? `(${reads.length})` : ''}
        </Text>
        {!readOnly && (
          <Pressable
            onPress={onLogRead}
            className="flex-row items-center gap-1.5 rounded-full bg-primary/15 px-3 py-1.5 active:opacity-70"
          >
            <Play size={13} color={COLORS.accent} fill={COLORS.accent} />
            <Text className="text-xs font-semibold text-primary">Log a read</Text>
          </Pressable>
        )}
      </View>

      {shown.length === 0 ? (
        <Text className="text-xs text-muted-foreground">
          {readOnly ? 'No plays logged.' : 'Nothing logged yet — press Log a read when you put it on.'}
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
                </Text>
              </View>
              {!readOnly && !!onRemoveRead && (
                <Pressable
                  onPress={() => onRemoveRead(read.id)}
                  accessibilityLabel="Remove this read"
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
