import { Check, Minus, Plus } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

import { COLORS } from '@/theme/colors';

type TimesReadBoxProps = {
  /** Finishes in the read log — the ones with a day attached. */
  dated: number;
  /** Finishes the reader remembers but never logged. */
  undated: number;
  /** Bumping the total up is "I finished it again", which happened now. */
  onLogRead: () => void;
  /** Bumping down past the undated ones takes the newest logged read off. */
  onRemoveNewestRead: () => void;
  onSetUndated: (undated: number) => void;
};

/**
 * How many times this book has been finished — Radar's watched box, translated
 * (`../radar/src/components/media/StatusPicker.tsx`).
 *
 * The rule it exists for is Radar's: **times finished = dated + undated**. A
 * streak is built from days, so a finish with no date cannot move one — and
 * before this there was no way to say "I read this years ago and never logged
 * it" without either inventing the day it happened on, which corrupts the
 * streak, or leaving the book's history a lie.
 *
 * So the top stepper is the total and its `+` logs a real, dated read now; the
 * bottom one is the undated half, which counts towards this number and towards
 * the re-read ranking, and towards no calendar. Lowering the total takes an
 * undated finish off first, so a real date is never the thing thrown away.
 */
export function TimesReadBox({ dated, undated, onLogRead, onRemoveNewestRead, onSetUndated }: TimesReadBoxProps) {
  const total = dated + undated;

  const bumpTotal = (delta: number) => {
    if (delta > 0) {
      onLogRead();
      return;
    }
    if (total === 0) return;
    if (undated > 0) onSetUndated(undated - 1);
    else onRemoveNewestRead();
  };

  return (
    <View
      className="rounded-xl border p-3"
      style={{
        borderColor: total > 0 ? 'rgba(139,92,246,0.3)' : 'hsl(0 0% 14.9%)',
        backgroundColor: total > 0 ? 'rgba(139,92,246,0.1)' : 'transparent',
      }}
    >
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          <Check size={18} color={total > 0 ? COLORS.accent : COLORS.foreground} />
          <Text className={total > 0 ? 'font-medium text-primary' : 'font-medium text-foreground'}>
            {total === 0 ? 'Not finished yet' : `Finished ${total}×`}
          </Text>
        </View>
        <Stepper
          value={total}
          onDown={() => bumpTotal(-1)}
          onUp={() => bumpTotal(1)}
          downLabel="One finish fewer"
          upLabel="Log another finish, today"
        />
      </View>

      {/* Where those finishes came from, and the one action that adds one
          without touching a streak. Offered on an unread book too: "I read this
          before I ever tracked it" is exactly the missing case. */}
      <View className="mt-3 gap-2 border-t border-border/60 pt-3">
        <View className="flex-row items-center justify-between gap-3">
          <View className="flex-1">
            <Text className="text-xs font-medium text-foreground">Finished before, no date</Text>
            <Text className="text-[11px] leading-4 text-muted-foreground">
              Counts towards your totals, never towards a streak
            </Text>
          </View>
          <Stepper
            value={undated}
            onDown={() => onSetUndated(Math.max(0, undated - 1))}
            onUp={() => onSetUndated(undated + 1)}
            downLabel="One undated finish fewer"
            upLabel="One undated finish more"
          />
        </View>
        {total > 0 && (
          <Text className="text-[11px] text-muted-foreground">
            {dated > 0 ? `${dated} dated` : 'none dated'}
            {undated > 0 ? ` · ${undated} undated` : ''}
          </Text>
        )}
      </View>
    </View>
  );
}

function Stepper({
  value,
  onDown,
  onUp,
  downLabel,
  upLabel,
}: {
  value: number;
  onDown: () => void;
  onUp: () => void;
  downLabel: string;
  upLabel: string;
}) {
  return (
    <View className="flex-row items-center gap-2 rounded-lg bg-black/30 p-1">
      <Pressable onPress={onDown} hitSlop={6} accessibilityLabel={downLabel} className="p-1 active:opacity-60">
        <Minus size={14} color={COLORS.muted} />
      </Pressable>
      <Text className="w-6 text-center font-mono text-sm text-foreground">{value}</Text>
      <Pressable onPress={onUp} hitSlop={6} accessibilityLabel={upLabel} className="p-1 active:opacity-60">
        <Plus size={14} color={COLORS.muted} />
      </Pressable>
    </View>
  );
}
