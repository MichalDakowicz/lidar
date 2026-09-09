import { Check, RotateCcw } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

import { COLORS } from '@/theme/colors';

type ProgressActionsProps = {
  /** Committing the typed page would put the reader on the last page. */
  finishes: boolean;
  canSave: boolean;
  saving: boolean;
  onSave: () => void;
  /** Clears the bookmark outright, for a book about to be read again. */
  onReset: (() => void) | null;
};

/**
 * Move the bookmark, or throw it away. Nothing else.
 *
 * There is no Finished button here. Reaching the last page *is* finishing, so
 * the save that lands there logs the read (lib/progress.finishesBook) and this
 * button says so before it is pressed. The one manual finish left is the
 * times-finished box above the panel, which credits whatever the ledger has not
 * already counted — two buttons doing the same job is how a book gets finished
 * without its pages, or counted twice.
 *
 * **Reset** is the re-read: it clears the bookmark so the next pass starts from
 * the beginning again. It costs nothing — the pages already read stay in the
 * ledger, so the streak, the calendar and the year's total are untouched.
 */
export function ProgressActions({ finishes, canSave, saving, onSave, onReset }: ProgressActionsProps) {
  return (
    <View className="flex-row items-center gap-2">
      <Pressable
        onPress={onSave}
        disabled={!canSave}
        accessibilityRole="button"
        accessibilityLabel={finishes ? 'Save the last page and finish the book' : 'Save the page'}
        className={
          finishes
            ? 'flex-1 flex-row items-center justify-center gap-1.5 rounded-xl bg-primary py-3 active:opacity-70'
            : 'flex-1 flex-row items-center justify-center gap-1.5 rounded-xl border border-border bg-secondary py-3 active:opacity-70'
        }
        style={{ opacity: canSave ? 1 : 0.5 }}
      >
        {finishes && <Check size={16} color="#fafafa" strokeWidth={2.5} />}
        <Text className={finishes ? 'text-sm font-semibold text-primary-foreground' : 'text-sm font-semibold text-foreground'}>
          {saving ? 'Saving…' : finishes ? 'Finish book' : 'Save page'}
        </Text>
      </Pressable>

      <Pressable
        onPress={() => onReset?.()}
        disabled={!onReset}
        accessibilityRole="button"
        accessibilityLabel="Clear the bookmark to read it again — the pages you read stay counted"
        className="flex-row items-center gap-1.5 rounded-xl border border-border bg-secondary px-3 py-3 active:opacity-70"
        style={{ opacity: onReset ? 1 : 0.4 }}
      >
        <RotateCcw size={14} color={COLORS.muted} />
        <Text className="text-xs font-medium text-muted-foreground">Reset</Text>
      </Pressable>
    </View>
  );
}
