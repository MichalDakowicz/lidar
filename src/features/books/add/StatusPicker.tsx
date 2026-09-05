import { Pressable, Text, View } from 'react-native';

import { StatusGlyph } from '@/components/media/Glyphs';
import { STATUSES } from '@/lib/bookStatus';
import { COLORS } from '@/theme/colors';
import type { BookStatus } from '@/types/book';

type StatusPickerProps = {
  status: BookStatus;
  onStatusChange: (status: BookStatus) => void;
};

/**
 * The one question every add and edit asks: where is this book in your reading.
 * One component, used by the Quick-Add sheet and the book editor, so the
 * control cannot drift apart between the two.
 *
 * Four mutually exclusive options, so they wrap rather than sharing one row —
 * "Did not finish" does not fit a quarter of a phone's width.
 */
export function StatusPicker({ status, onStatusChange }: StatusPickerProps) {
  return (
    <View className="gap-2">
      <Text className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Status</Text>
      <View className="flex-row flex-wrap gap-2">
        {STATUSES.map((option) => {
          const active = status === option.value;
          return (
            <Pressable
              key={option.value}
              onPress={() => onStatusChange(option.value)}
              className="min-w-[45%] flex-1 flex-row items-center justify-center gap-1.5 rounded-lg border py-2.5"
              style={{
                borderColor: active ? option.color : 'hsl(0 0% 20%)',
                backgroundColor: active ? option.tint : 'transparent',
              }}
            >
              <StatusGlyph status={option.value} size={15} color={active ? option.color : COLORS.muted} />
              <Text
                className="text-xs font-semibold"
                style={{ color: active ? option.color : COLORS.muted }}
                numberOfLines={1}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
