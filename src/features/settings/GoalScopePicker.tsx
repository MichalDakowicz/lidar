import { Pressable, Text, View } from 'react-native';

import type { GoalScope } from '@/lib/weeklyGoal';

const OPTIONS: { scope: GoalScope; title: string; detail: string }[] = [
  { scope: 'from-now', title: 'From this week on', detail: 'Earlier weeks keep the goal they were read under' },
  { scope: 'whole-history', title: 'The whole history', detail: 'Every week is counted against the new goal' },
];

type GoalScopePickerProps = {
  value: GoalScope;
  onChange: (scope: GoalScope) => void;
};

/**
 * How far a changed goal reaches. Two segmented options, the same shape as the
 * sign-out picker, with the one that cannot rewrite the past as the default.
 */
export function GoalScopePicker({ value, onChange }: GoalScopePickerProps) {
  return (
    <View className="gap-2">
      {OPTIONS.map((option) => {
        const active = option.scope === value;
        return (
          <Pressable
            key={option.scope}
            onPress={() => onChange(option.scope)}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            accessibilityLabel={option.title}
            className={`gap-0.5 rounded-xl border px-3.5 py-3 active:opacity-70 ${
              active ? 'border-primary bg-primary/10' : 'border-border'
            }`}
          >
            <Text className={`text-[14.5px] ${active ? 'font-semibold text-primary' : 'text-foreground'}`}>
              {option.title}
            </Text>
            <Text className="text-xs text-muted-foreground">{option.detail}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
