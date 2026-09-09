import { Trash2 } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

import { COLORS } from '@/theme/colors';

type RemoveFromLibraryProps = {
  onPress: () => void;
};

/**
 * The last thing on a book page, under a rule of its own.
 *
 * It used to be the header CTA — a pill reading "On your shelf" that removed
 * the book when tapped. Two things were wrong with that. It sat between the
 * jacket and the rating editor, so every visit scrolled past a button nobody
 * opens a book page to press; and a destructive action disguised as a status
 * badge is the kind of thing that gets tapped to find out what it does.
 *
 * Down here it is honest about what it is and costs nothing to ignore. Being
 * on the shelf is said by the shelf controls above instead, which is where the
 * reader is looking anyway.
 */
export function RemoveFromLibrary({ onPress }: RemoveFromLibraryProps) {
  return (
    <View className="gap-2 border-t border-border pt-6">
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel="Remove this book from your library"
        className="flex-row items-center justify-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 py-3 active:opacity-70"
      >
        <Trash2 size={16} color={COLORS.danger} />
        <Text className="text-sm font-semibold text-red-400">Remove from library</Text>
      </Pressable>
      <Text className="text-center text-xs text-muted-foreground">
        Your rating and review are kept — they belong to the book, not to your copy
      </Text>
    </View>
  );
}
