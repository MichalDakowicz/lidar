import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { clampWeeklyPages, useReadingGoal } from '@/store/readingGoal';
import { COLORS } from '@/theme/colors';

import { SettingLabel } from './SettingsSection';

/**
 * Pages a week the reading streak asks for. A week that clears it keeps the
 * streak alive even with nights off — see lib/streak — so this is the dial
 * between "a habit I can keep" and "a target I will miss".
 *
 * Typed, not picked. Five preset numbers cannot be anyone's actual pace, and
 * the one goal a reader wants is always the one between two of them. The
 * steppers flank the field the way the number grows: ±1 and ±5 stacked half
 * height beside it, ±10 full height on the outside, so a nudge and a jump are
 * different targets rather than the same button pressed a different number of
 * times.
 *
 * The row is sized from the smallest target rather than from the look: a half
 * height box still has to be a box a thumb can hit, so the halves are 46pt tall
 * and 48 wide, and everything else — the tall steppers, the field — is built up
 * from that. Four 48pt columns and their gaps leave the field about 96pt on a
 * 360pt phone, which is why the steppers are not wider than they are.
 */
export function WeeklyGoalControl() {
  const { weeklyPages, setWeeklyPages } = useReadingGoal();
  const [draft, setDraft] = useState(String(weeklyPages));

  // Re-sync when the stored goal moves under the field — a stepper press, or
  // another screen. Adjusted during render rather than in an effect: an effect
  // would paint the stale number for a frame first.
  const [seen, setSeen] = useState(weeklyPages);
  if (seen !== weeklyPages) {
    setSeen(weeklyPages);
    setDraft(String(weeklyPages));
  }

  const bump = (delta: number) => setWeeklyPages(weeklyPages + delta);

  // An empty field is someone mid-edit, not a goal of zero: it commits as the
  // last good number rather than snapping to the minimum under their fingers.
  const commit = () => {
    const typed = Number.parseInt(draft.trim(), 10);
    if (Number.isNaN(typed)) {
      setDraft(String(weeklyPages));
      return;
    }
    const next = clampWeeklyPages(typed);
    setDraft(String(next));
    if (next !== weeklyPages) setWeeklyPages(next);
  };

  return (
    <>
      <SettingLabel title="Weekly page goal" description="Pages a week to keep your reading streak" />

      <View className="flex-row items-stretch gap-1.5">
        <TallStep label="−10" onPress={() => bump(-10)} accessibilityLabel="Ten pages fewer" />
        <StackedSteps
          top={{ label: '−1', onPress: () => bump(-1), accessibilityLabel: 'One page fewer' }}
          bottom={{ label: '−5', onPress: () => bump(-5), accessibilityLabel: 'Five pages fewer' }}
        />

        <View className="h-24 min-w-0 flex-1 justify-center rounded-xl border border-border bg-secondary px-2">
          <TextInput
            value={draft}
            onChangeText={setDraft}
            onBlur={commit}
            onSubmitEditing={commit}
            keyboardType="number-pad"
            returnKeyType="done"
            selectTextOnFocus
            accessibilityLabel="Pages a week"
            className="text-center text-2xl font-semibold text-foreground"
          />
        </View>

        <StackedSteps
          top={{ label: '+1', onPress: () => bump(1), accessibilityLabel: 'One page more' }}
          bottom={{ label: '+5', onPress: () => bump(5), accessibilityLabel: 'Five pages more' }}
        />
        <TallStep label="+10" onPress={() => bump(10)} accessibilityLabel="Ten pages more" />
      </View>
    </>
  );
}

type Step = { label: string; onPress: () => void; accessibilityLabel: string };

/** ±10: one box the height of the field, on the outside of the row. */
function TallStep({ label, onPress, accessibilityLabel }: Step) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      className="h-24 w-12 items-center justify-center rounded-xl border border-border bg-secondary active:opacity-60"
    >
      <Text className="text-base font-semibold" style={{ color: COLORS.accent }}>
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * ±1 over ±5: two half-height boxes filling the same slot as a tall one.
 *
 * Half height is the look, not the target — at 96 tall with a 4pt gap each box
 * is 46, which clears the 44pt a thumb needs. Shrinking the row is what would
 * break them, so the height is set here rather than left to the contents.
 */
function StackedSteps({ top, bottom }: { top: Step; bottom: Step }) {
  return (
    <View className="h-24 w-12 gap-1">
      {[top, bottom].map((step) => (
        <Pressable
          key={step.label}
          onPress={step.onPress}
          accessibilityRole="button"
          accessibilityLabel={step.accessibilityLabel}
          className="flex-1 items-center justify-center rounded-lg border border-border bg-secondary active:opacity-60"
        >
          <Text className="text-sm font-semibold text-foreground">{step.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}
