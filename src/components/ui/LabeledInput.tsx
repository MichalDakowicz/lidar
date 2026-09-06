import { Text, TextInput, View } from 'react-native';

import { COLORS } from '@/theme/colors';

type LabeledInputProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  numeric?: boolean;
};

/**
 * A label over a field, the shape every editable book detail takes. Shared so
 * the page fields read the same wherever they are shown — they sit in the
 * progress panel and the rest sit under it, and two nearly-identical local
 * copies is how those quietly drift apart.
 *
 * `flex-1` with a zero basis: side by side in a row, two of these are exactly
 * the same width whatever their contents.
 */
export function LabeledInput({ label, value, onChangeText, placeholder, multiline, numeric }: LabeledInputProps) {
  return (
    <View className="min-w-0 flex-1 gap-1.5" style={{ flexBasis: 0 }}>
      <Text className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={COLORS.muted}
        multiline={multiline}
        keyboardType={numeric ? 'number-pad' : 'default'}
        className={`rounded-lg border bg-secondary px-3 py-2.5 text-sm text-foreground ${
          multiline ? 'min-h-24 leading-relaxed' : ''
        }`}
        style={{ borderColor: 'hsl(0 0% 14.9%)' }}
      />
    </View>
  );
}
