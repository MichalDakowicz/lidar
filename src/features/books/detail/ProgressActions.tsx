import { BookCheck, Check, RotateCcw } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

import { COLORS } from '@/theme/colors';

type ProgressActionsProps = {
  /** Committing the typed page would put the reader on the last page. */
  finishes: boolean;
  canSave: boolean;
  saving: boolean;
  onSave: () => void;
  /** Fills the field with the last page. Null when the edition has no length. */
  onLastPage: (() => void) | null;
  /** Clears the bookmark outright, for a book about to be read again. */
  onReset: (() => void) | null;
};

/**
 * The three things you can do to a bookmark: move it, send it to the end, or
 * throw it away.
 *
 * There is no Finished button here, and that is deliberate. Reaching the last
 * page *is* finishing, so the save that lands there logs the read (lib/progress
 * .finishesBook) and this button says so before it is pressed. A button whose
 * only job was to duplicate that made it possible to finish a book without the
 * pages ever being counted, and to count them twice by pressing both.
 *
 * **Last page** exists for the reader who tracks by the page they will open on
 * next: there is no page after the last one to type, so without it the final
 * page of every book was unreachable. It fills the field rather than saving, so
 * the receipt gets to show what the finish is worth first.
 *
 * **Reset** is the re-read: it clears the bookmark so the next pass starts from
 * the beginning again. Nothing is lost — the pages already read stay in the
 * ledger, and the finishes stay in the log.
 */
export function ProgressActions({ finishes, canSave, saving, onSave, onLastPage, onReset }: ProgressActionsProps) {
  const saveLabel = saving ? 'Saving…' : finishes ? 'Finish book' : 'Save page';

  return (
    <View className="gap-2">
      <Pressable
        onPress={onSave}
        disabled={!canSave}
        accessibilityRole="button"
        accessibilityLabel={finishes ? 'Save the last page and finish the book' : 'Save the page'}
        className={
          finishes
            ? 'flex-row items-center justify-center gap-1.5 rounded-xl bg-primary py-3 active:opacity-70'
            : 'flex-row items-center justify-center gap-1.5 rounded-xl border border-border bg-secondary py-3 active:opacity-70'
        }
        style={{ opacity: canSave ? 1 : 0.5 }}
      >
        {finishes && <Check size={16} color="#fafafa" strokeWidth={2.5} />}
        <Text className={finishes ? 'text-sm font-semibold text-primary-foreground' : 'text-sm font-semibold text-foreground'}>
          {saveLabel}
        </Text>
      </Pressable>

      <View className="flex-row items-center gap-2">
        <SecondaryAction
          icon={<BookCheck size={15} color={COLORS.muted} />}
          label="Last page"
          hint="Fill in the last page of the book"
          onPress={onLastPage}
        />
        <SecondaryAction
          icon={<RotateCcw size={15} color={COLORS.muted} />}
          label="Reset"
          hint="Clear the bookmark to read it again"
          onPress={onReset}
        />
      </View>
    </View>
  );
}

function SecondaryAction({
  icon,
  label,
  hint,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  hint: string;
  onPress: (() => void) | null;
}) {
  return (
    <Pressable
      onPress={() => onPress?.()}
      disabled={!onPress}
      accessibilityRole="button"
      accessibilityLabel={hint}
      className="min-w-0 flex-1 flex-row items-center justify-center gap-1.5 rounded-xl border border-border bg-secondary py-2.5 active:opacity-70"
      style={{ flexBasis: 0, opacity: onPress ? 1 : 0.4 }}
    >
      {icon}
      <Text className="text-xs font-medium text-muted-foreground">{label}</Text>
    </Pressable>
  );
}
