import { Text, View } from 'react-native';

import { LabeledInput } from '@/components/ui/LabeledInput';

import { CoverPicker } from './CoverPicker';
import type { BookForm } from '../edit/bookForm';

type BookDetailsProps = {
  form: BookForm;
  onChange: (patch: Partial<BookForm>) => void;
};

/**
 * The part of a book that is yours rather than the catalogue's: the passages
 * you keep coming back to, your notes, the link, and the cover — which for a
 * Polish book is always yours to supply, because neither Polish catalogue
 * publishes jacket art.
 *
 * Nothing here is about owning a copy — no price, no store, no edition number.
 * Lidar tracks reading, so what it asks about is the reading.
 */
export function BookDetails({ form, onChange }: BookDetailsProps) {
  return (
    <View className="gap-5">
      <Text className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Your notes</Text>

      <LabeledInput
        label="Favourite passages"
        value={form.favoriteQuotes}
        onChangeText={(favoriteQuotes) => onChange({ favoriteQuotes })}
        placeholder="Page 214, the ending…"
      />

      <LabeledInput
        label="Notes"
        value={form.notes}
        onChangeText={(notes) => onChange({ notes })}
        placeholder="What you made of it, where you were when you read it…"
        multiline
      />

      <LabeledInput
        label="Book link"
        value={form.url}
        onChangeText={(url) => onChange({ url })}
        placeholder="https://books.google.com/…"
      />

      <View className="gap-2">
        <LabeledInput
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
