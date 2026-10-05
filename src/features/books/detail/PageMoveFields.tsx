import { BookOpen, Lock } from 'lucide-react-native';
import type { Ref } from 'react';
import { Text, TextInput, View } from 'react-native';

import { COLORS } from '@/theme/colors';

type PageMoveFieldsProps = {
  /** The page already saved, in the reader's bookmark mode. */
  saved: number | null;
  draft: string;
  onChange: (text: string) => void;
  onSubmit: () => void;
  inputRef?: Ref<TextInput>;
  /** Select the saved page on focus, so a quick log types straight over it. */
  selectOnFocus?: boolean;
};

/**
 * The page already saved, locked, beside the page you are on now. The pairing
 * is the whole interaction: the reader never has to remember or subtract.
 *
 * The two halves are the same width and the same height: a zero flex basis
 * makes them equal whatever either one is holding.
 */
export function PageMoveFields({ saved, draft, onChange, onSubmit, inputRef, selectOnFocus }: PageMoveFieldsProps) {
  return (
    <View className="flex-row items-end gap-2">
      <View className="min-w-0 flex-1 gap-1.5" style={{ flexBasis: 0 }}>
        <Text className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Last saved</Text>
        <View className="h-11 flex-row items-center gap-2 rounded-lg border border-border bg-background px-3 opacity-70">
          <Lock size={15} color={COLORS.mutedDeep} />
          <Text numberOfLines={1} className="flex-1 text-sm text-muted-foreground">
            {saved == null ? 'Not started' : saved}
          </Text>
        </View>
      </View>

      <View className="min-w-0 flex-1 gap-1.5" style={{ flexBasis: 0 }}>
        <Text className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Now on page</Text>
        <View className="h-11 flex-row items-center gap-2 rounded-lg border border-border bg-secondary px-3">
          <BookOpen size={15} color={COLORS.muted} />
          <TextInput
            ref={inputRef}
            value={draft}
            onChangeText={onChange}
            onSubmitEditing={onSubmit}
            keyboardType="number-pad"
            returnKeyType="done"
            selectTextOnFocus={selectOnFocus}
            placeholder={saved == null ? 'Page…' : String(saved)}
            placeholderTextColor={COLORS.mutedDeep}
            className="flex-1 text-sm text-foreground"
            accessibilityLabel="New page"
          />
        </View>
      </View>
    </View>
  );
}
