import { Text, TextInput, View } from 'react-native';

import { countablePages, firstPage } from '@/lib/pages';
import { COLORS } from '@/theme/colors';

import { CoverPicker } from './CoverPicker';
import type { BookForm, FormIssues } from '../edit/bookForm';

type BookDetailsProps = {
  form: BookForm;
  onChange: (patch: Partial<BookForm>) => void;
  /** Set by a failed save. The page fields are the only ones that can fail here. */
  issues?: FormIssues;
};

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
  numeric,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  numeric?: boolean;
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
        keyboardType={numeric ? 'number-pad' : 'default'}
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
 * you keep coming back to, your notes, the link, and the cover — which for a
 * Polish book is always yours to supply, because neither Polish catalogue
 * publishes jacket art.
 *
 * Nothing here is about owning a copy — no price, no store, no edition number.
 * Lidar tracks reading, so what it asks about is the reading.
 */
export function BookDetails({ form, onChange, issues = {} }: BookDetailsProps) {
  // Echoed back as they type: the number that changes is the one the streak
  // will count, so it is worth showing rather than explaining.
  const span = {
    pageCount: Number.parseInt(form.pageCount, 10) || null,
    startPage: Number.parseInt(form.startPage, 10) || null,
  };
  const countable = countablePages(span) ?? 0;
  const start = firstPage(span);
  const startsLate = start > 1 && countable > 0;

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

      <View className="gap-1.5">
        <View className="flex-row gap-3">
          <Field
            label="Pages"
            value={form.pageCount}
            onChangeText={(pageCount) => onChange({ pageCount })}
            placeholder="384"
            numeric
          />
          <Field
            label="Story starts on"
            value={form.startPage}
            onChangeText={(startPage) => onChange({ startPage })}
            placeholder="1"
            numeric
          />
        </View>
        {issues.pageCount || issues.startPage ? (
          <Text className="text-xs text-red-500">{issues.pageCount ?? issues.startPage}</Text>
        ) : (
          <Text className="text-xs text-muted-foreground">
            {startsLate
              ? `${countable.toLocaleString()} pages of reading — the front matter before page ${start} does not count towards your streak.`
              : 'Books rarely open on page 1. Say where the story starts and the progress bar and your page totals skip the front matter.'}
          </Text>
        )}
      </View>

      <Field
        label="Book link"
        value={form.url}
        onChangeText={(url) => onChange({ url })}
        placeholder="https://books.google.com/…"
      />

      <View className="gap-2">
        <Field
          label="Cover"
          value={form.coverUrl.startsWith('data:') ? 'Your own photo' : form.coverUrl}
          onChangeText={(coverUrl) => onChange({ coverUrl })}
          placeholder="https://… or pick a photo below"
        />
        {/* Neither Polish catalogue publishes jacket art, so a book found there
            has no cover to show until someone supplies one. Until then the grid
            draws one from the title — see components/media/GeneratedCover. */}
        <CoverPicker
          hasCover={!!form.coverUrl.trim()}
          onPicked={(coverUrl) => onChange({ coverUrl })}
          onCleared={() => onChange({ coverUrl: '' })}
        />
      </View>
    </View>
  );
}
