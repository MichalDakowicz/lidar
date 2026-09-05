import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { ImagePlus, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, Text, View } from 'react-native';

import { useToast } from '@/components/ui/Toast';
import { COLORS } from '@/theme/colors';

/**
 * Put your own picture on a book the catalogues have no jacket for.
 *
 * Stored inline as a data URI in `books.cover_url`, the same trick the avatar
 * uses for `profiles.pfp` — no storage bucket, no policy to add to the shared
 * project, and nothing to clean up when a book is deleted.
 *
 * The size cap is what makes that safe. `useBooks` selects every column of
 * every row, so a cover rides along in the library query: at 320px wide and
 * JPEG q0.6 one is about 20KB of base64, and only the handful of books no
 * catalogue could picture ever get one. A full-resolution photo here would put
 * megabytes into a list fetch.
 */
const MAX_WIDTH = 320;
const QUALITY = 0.6;

async function pickCover(): Promise<string | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    // Book jackets are portraits; cropping to 2:3 up front means the tile shows
    // what the user framed rather than the middle of it.
    aspect: [2, 3],
    quality: 1,
  });
  if (result.canceled || !result.assets[0]) return null;

  const manipulated = await ImageManipulator.manipulateAsync(
    result.assets[0].uri,
    [{ resize: { width: MAX_WIDTH } }],
    { compress: QUALITY, format: ImageManipulator.SaveFormat.JPEG, base64: true },
  );
  return manipulated.base64 ? `data:image/jpeg;base64,${manipulated.base64}` : null;
}

type CoverPickerProps = {
  /** True once a cover exists, whatever supplied it. */
  hasCover: boolean;
  onPicked: (dataUri: string) => void;
  onCleared: () => void;
};

export function CoverPicker({ hasCover, onPicked, onCleared }: CoverPickerProps) {
  const { show } = useToast();
  const [busy, setBusy] = useState(false);

  // expo-image-picker's library flow needs a native module; on web the URL
  // field above this is the whole story.
  if (Platform.OS === 'web') return null;

  const choose = async () => {
    setBusy(true);
    try {
      const dataUri = await pickCover();
      if (dataUri) onPicked(dataUri);
      else show('No photo picked');
    } catch (error) {
      show(error instanceof Error ? error.message : 'Could not read that photo');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View className="flex-row gap-2">
      <Pressable
        onPress={choose}
        disabled={busy}
        className="flex-1 flex-row items-center justify-center gap-2 rounded-lg border border-border py-2.5 active:opacity-70"
        style={{ opacity: busy ? 0.6 : 1 }}
      >
        {busy ? <ActivityIndicator size="small" color={COLORS.accent} /> : <ImagePlus size={16} color={COLORS.foreground} />}
        <Text className="text-sm font-medium text-foreground">
          {hasCover ? 'Replace cover' : 'Use a photo as the cover'}
        </Text>
      </Pressable>

      {hasCover && (
        <Pressable
          onPress={onCleared}
          accessibilityLabel="Remove cover"
          className="items-center justify-center rounded-lg border border-border px-3.5 active:opacity-70"
        >
          <Trash2 size={16} color={COLORS.danger} />
        </Pressable>
      )}
    </View>
  );
}
