import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import type { GoalScope } from '@/lib/weeklyGoal';
import { COLORS } from '@/theme/colors';

import { GoalScopePicker } from './GoalScopePicker';

type GoalApplyProps = {
  /** The goal in force. */
  current: number;
  /** The goal waiting in the field. */
  goal: number;
  /** There are weeks behind this one, so "from now or the whole history" is a real question. */
  askScope: boolean;
  onApply: (scope: GoalScope) => void;
  onCancel: () => void;
};

/**
 * The step between typing a new goal and it taking effect.
 *
 * The steppers are tapped in runs — +10 four times — so the goal cannot be
 * written on every press and asked about each time. It waits in the field until
 * this is pressed, and only then, if there is a past for it to rewrite, asks how
 * far it reaches. A reader with nothing behind this week is not asked: the two
 * answers would be the same.
 */
export function GoalApply({ current, goal, askScope, onApply, onCancel }: GoalApplyProps) {
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<GoalScope>('from-now');

  const press = () => {
    if (!askScope) {
      onApply('whole-history');
      return;
    }
    // Opens on "from this week" every time, so rewriting the past is a choice
    // someone made, never one left over from last time.
    setScope('from-now');
    setOpen(true);
  };

  return (
    <>
      <View className="gap-1">
        <Pressable
          onPress={press}
          accessibilityRole="button"
          className="items-center rounded-lg border py-3 active:opacity-80"
          style={{ borderColor: COLORS.accent, backgroundColor: COLORS.accentSoft }}
        >
          <Text className="text-sm font-medium" style={{ color: COLORS.accent }}>
            Set goal to {goal.toLocaleString()} pages a week
          </Text>
        </Pressable>
        <Pressable onPress={onCancel} className="py-1 active:opacity-70">
          <Text className="text-center text-xs text-muted-foreground underline">Keep {current.toLocaleString()}</Text>
        </Pressable>
      </View>

      <ConfirmDialog
        visible={open}
        title="Change the weekly goal?"
        description={`From ${current.toLocaleString()} to ${goal.toLocaleString()} pages a week. Which weeks should it count for?`}
        confirmLabel="Change goal"
        onConfirm={() => {
          setOpen(false);
          onApply(scope);
        }}
        onCancel={() => setOpen(false)}
      >
        <GoalScopePicker value={scope} onChange={setScope} />
      </ConfirmDialog>
    </>
  );
}
