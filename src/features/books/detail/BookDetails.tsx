import { Text, TextInput, View } from 'react-native';

import { COLORS } from '@/theme/colors';

import type { BookForm } from '../edit/bookForm';

type BookDetailsProps = {
  form: BookForm;
  onChange: (patch: Partial<BookForm>) => void;
};

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
}) {
  return (
    <View className="min-w-0 flex-1 gap-1.5">
      <Text className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={COLORS.muted}
        multiline={multiline}
        className={`rounded-lg border bg-secondary px-3 py-2.5 text-sm text-foreground ${
          multiline ? 'min-h-24 leading-relaxed' : ''
        }`}
        style={{ borderColor: 'hsl(0 0% 14.9%)' }}
      />
    </View>
  );
}

/**
 * The part of a book that is yours rather than the catalogue's: the passages
 * you keep coming back to, your notes, and the two links the catalogue may have
 * got wrong.
 *
 * Nothing here is about owning a copy — no price, no store, no edition number.
 * Lidar tracks reading, so what it asks about is the reading.
 */
export function BookDetails({ form, onChange }: BookDetailsProps) {
  return (
    <View className="gap-5">
      <Text className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Your notes</Text>

      <Field
        label="Favourite passages"
        value={form.favoriteQuotes}
        onChangeText={(favoriteQuotes) => onChange({ favoriteQuotes })}
        placeholder="Page 214, the ending…"
      />

      <Field
        label="Notes"
        value={form.notes}
        onChangeText={(notes) => onChange({ notes })}
        placeholder="What you made of it, where you were when you read it…"
        multiline
      />

      <Field
        label="Book link"
        value={form.url}
        onChangeText={(url) => onChange({ url })}
        placeholder="https://books.google.com/…"
      />

      <Field
        label="Cover image URL"
        value={form.coverUrl}
        onChangeText={(coverUrl) => onChange({ coverUrl })}
        placeholder="https://…"
      />
    </View>
  );
}
