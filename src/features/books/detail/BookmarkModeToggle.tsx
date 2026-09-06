import { Pressable, Text, View } from 'react-native';

import { COLORS } from '@/theme/colors';
import type { BookmarkMode } from '@/lib/progress';

type BookmarkModeToggleProps = {
  mode: BookmarkMode;
  onChange: (mode: BookmarkMode) => void;
};

const OPTIONS: { id: BookmarkMode; label: string }[] = [
  { id: 'finished', label: 'the last page I finished' },
  { id: 'next', label: "the next page I'll read" },
];

/**
 * Which number the reader is typing.
 *
 * *Page 120* means "I finished 120" to one person and "I am about to read 120"
 * to the next, and a book tracked one way one week and the other the next
 * produces a page count that is quietly wrong. Rather than guess, the panel
 * says out loud which number it wants and remembers the answer
 * (store/bookmarkMode) — so after the first book this is one tap that never
 * happens again.
 */
export function BookmarkModeToggle({ mode, onChange }: BookmarkModeToggleProps) {
  return (
    <View className="gap-1.5">
      {OPTIONS.map((option) => {
        const selected = mode === option.id;
        return (
          <Pressable
            key={option.id}
            onPress={() => onChange(option.id)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            hitSlop={4}
            className="flex-row items-center gap-2.5 active:opacity-70"
          >
            <View
              className="h-4 w-4 items-center justify-center rounded-full border"
              style={{ borderColor: selected ? COLORS.accent : COLORS.mutedDeep }}
            >
              {selected && <View className="h-2 w-2 rounded-full" style={{ backgroundColor: COLORS.accent }} />}
            </View>
            <Text className={selected ? 'text-xs text-foreground' : 'text-xs text-muted-foreground'}>
              {`I'm typing ${option.label}`}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
