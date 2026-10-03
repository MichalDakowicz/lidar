import { Pressable, Text, View } from 'react-native';

import { RATING_KINDS, type RatingKind } from '@/lib/ratings';

type RatingKindToggleProps = {
  kind: RatingKind;
  onChange: (kind: RatingKind) => void;
};

/**
 * Story or true account — which questions the rating asks. The editor opens on
 * the set the book's genres suggest; this is how you overrule it, and the line
 * under it says what the chosen set is for so the switch explains itself.
 */
export function RatingKindToggle({ kind, onChange }: RatingKindToggleProps) {
  return (
    <View className="gap-2">
      <View className="flex-row gap-1 rounded-full border border-border bg-secondary p-1">
        {RATING_KINDS.map((option) => {
          const active = option.value === kind;
          return (
            <Pressable
              key={option.value}
              onPress={() => onChange(option.value)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              className={`flex-1 items-center rounded-full py-2 ${active ? 'bg-primary' : 'active:opacity-70'}`}
            >
              <Text className={active ? 'text-sm font-semibold text-primary-foreground' : 'text-sm text-muted-foreground'}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Text className="text-xs text-muted-foreground">{RATING_KINDS.find((option) => option.value === kind)?.hint}</Text>
    </View>
  );
}
