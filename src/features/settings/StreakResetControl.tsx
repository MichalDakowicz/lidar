import { RotateCcw } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { useToast } from '@/components/ui/Toast';
import { useStreakEpoch } from '@/store/streakEpoch';
import { COLORS } from '@/theme/colors';

import { SettingLabel } from './SettingsSection';

const CONFIRM_MS = 4000;

/** The cut-off, as a reader would say it. */
function formatSince(since: string): string {
  const date = new Date(since);
  return Number.isNaN(date.getTime())
    ? 'an unknown date'
    : date.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
}

/**
 * Restarts the reading streak and the calendar from today.
 *
 * Deliberately not a delete: every read keeps its row, its pages and its place
 * in the year's totals — see store/streakEpoch. Two taps rather than a system
 * dialog, because react-native-web has no Alert worth showing and a habit you
 * have been building for months should not go on one stray press.
 */
export function StreakResetControl() {
  const { since, reset, clear } = useStreakEpoch();
  const { show } = useToast();
  const [armed, setArmed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // An armed button that stays armed is a trap the next time the screen opens.
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const arm = () => {
    setArmed(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setArmed(false), CONFIRM_MS);
  };

  const confirm = () => {
    if (timer.current) clearTimeout(timer.current);
    setArmed(false);
    reset();
    show('Reading streak restarted');
  };

  return (
    <>
      <SettingLabel
        title="Reading streak"
        description={
          since
            ? `Counting from ${formatSince(since)}. Everything you read before it is still on your shelf.`
            : 'Counting your whole reading history'
        }
      />
      <View className="gap-2">
        <Pressable
          onPress={armed ? confirm : arm}
          className={`flex-row items-center justify-center gap-2 rounded-lg border py-3 active:opacity-80 ${
            armed ? 'border-red-500 bg-red-500/10' : 'border-border bg-card'
          }`}
        >
          <RotateCcw size={16} color={armed ? COLORS.danger : COLORS.muted} />
          <Text className={`text-sm font-medium ${armed ? 'text-red-500' : 'text-foreground'}`}>
            {armed ? 'Tap again to restart from today' : 'Restart streak from today'}
          </Text>
        </Pressable>

        {since ? (
          <Pressable onPress={() => { clear(); show('Full reading history counted again'); }} className="py-1 active:opacity-70">
            <Text className="text-center text-xs text-muted-foreground underline">
              Undo — count my whole history again
            </Text>
          </Pressable>
        ) : null}
      </View>
    </>
  );
}
