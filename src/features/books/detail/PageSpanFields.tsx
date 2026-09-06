import { Text, View } from 'react-native';

import { LabeledInput } from '@/components/ui/LabeledInput';
import { countablePages, firstPage } from '@/lib/pages';

import type { BookForm, FormIssues } from '../edit/bookForm';

type PageSpanFieldsProps = {
  form: BookForm;
  onChange: (patch: Partial<BookForm>) => void;
  /** Set by a failed save. The page fields are the only ones that can fail. */
  issues?: FormIssues;
};

/**
 * How long the book is, and where its story starts — the two numbers every page
 * total is measured against (lib/pages).
 *
 * They sit directly above the page counter because they are what the counter
 * counts against: a bookmark typed against the wrong length is a progress bar
 * and a streak that are both quietly wrong, and the fix is right here rather
 * than further down the screen under someone's notes.
 *
 * The line underneath is echoed back as they type: the number that changes is
 * the one the streak will count, which is worth showing rather than explaining.
 */
export function PageSpanFields({ form, onChange, issues = {} }: PageSpanFieldsProps) {
  const span = {
    pageCount: Number.parseInt(form.pageCount, 10) || null,
    startPage: Number.parseInt(form.startPage, 10) || null,
  };
  const countable = countablePages(span) ?? 0;
  const start = firstPage(span);
  const startsLate = start > 1 && countable > 0;

  return (
    <View className="gap-1.5">
      <View className="flex-row gap-3">
        <LabeledInput
          label="Story starts on"
          value={form.startPage}
          onChangeText={(startPage) => onChange({ startPage })}
          placeholder="1"
          numeric
        />
        <LabeledInput
          label="Pages"
          value={form.pageCount}
          onChangeText={(pageCount) => onChange({ pageCount })}
          placeholder="384"
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
  );
}
