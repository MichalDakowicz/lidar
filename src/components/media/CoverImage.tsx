import { Image, type ImageLoadEventData } from 'expo-image';
import { BookOpen } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { GeneratedCover } from '@/components/media/GeneratedCover';

/** How far off 2:3 a jacket can be before it is letterboxed instead of cropped. */
const CROP_TOLERANCE = 0.08;
const TILE_RATIO = 2 / 3;

type CoverImageProps = {
  uri: string | null;
  /** Readlist covers are dimmed — you have not opened it yet. */
  dimmed?: boolean;
  /** Crossfade length. 0 for rapid source swaps (the random-pick reel). */
  transitionMs?: number;
  /** Icon size for the no-artwork fallback. */
  iconSize?: number;
  /**
   * Enough to draw a cover for a book that has none. Optional because the
   * banner and hero backdrops crop to shapes that text would not survive; those
   * callers leave it off and get the glyph.
   */
  generateFor?: { bookKey: string; title: string; authors: string[] };
};

/**
 * Book artwork; or a cover generated from the book's own details when the
 * catalogue has no jacket, which is every Polish record — see GeneratedCover.
 * Absolutely positioned so every caller controls the aspect box itself — a
 * cover fills its 2:3 tile in the grid but gets cropped to 16:9 in a banner.
 *
 * **Why this measures the image instead of just cropping it.** Google Books
 * thumbnails are already about 2:3, so cropping them costs nothing. Open
 * Library's `large` is not: its scans run anywhere from near-square to very
 * tall, and cropping one of those to a 2:3 tile shears the title off the top or
 * the author off the bottom — on the covers most likely to be an obscure
 * edition, which is exactly when you need to read them.
 *
 * So the jacket is measured on load. Anything close to 2:3 is cropped, which is
 * the common case and costs one image. Anything else is drawn whole over a
 * blurred copy of itself, which fills the tile without a letterbox reading as a
 * rendering bug.
 */
export function CoverImage({ uri, dimmed, transitionMs = 200, iconSize = 32, generateFor }: CoverImageProps) {
  // Measured rather than passed down: the same component fills a 60px carousel
  // thumbnail and a 200px grid card, and the generated cover's type has to scale
  // with whichever box it landed in.
  const [width, setWidth] = useState(0);
  const onLayout = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width);
  // Keyed by uri, not a bare number: FlashList recycles a cell for the next
  // book, and a ratio left over from the previous jacket would letterbox (or
  // crop) the new one on the strength of the old one's shape.
  const [measured, setMeasured] = useState<{ uri: string; ratio: number } | null>(null);

  if (!uri) {
    if (!generateFor) {
      return (
        <View className="absolute inset-0 items-center justify-center bg-neutral-800">
          <BookOpen size={iconSize} color="#52525b" />
        </View>
      );
    }
    return (
      <View className="absolute inset-0" onLayout={onLayout} style={{ opacity: dimmed ? 0.65 : 1 }}>
        <GeneratedCover
          bookKey={generateFor.bookKey}
          title={generateFor.title}
          authors={generateFor.authors}
          width={width || undefined}
        />
      </View>
    );
  }

  const onLoad = ({ source }: ImageLoadEventData) => {
    if (source?.width && source?.height) setMeasured({ uri, ratio: source.width / source.height });
  };

  // Until it has loaded, assume it crops: the common case, and it avoids a
  // visible re-layout on every cover that turns out to be the normal shape.
  const ratio = measured?.uri === uri ? measured.ratio : null;
  const letterbox = ratio != null && Math.abs(ratio - TILE_RATIO) > CROP_TOLERANCE;
  const opacity = dimmed ? 0.65 : 1;

  return (
    <>
      {letterbox && (
        <Image
          source={{ uri }}
          style={[StyleSheet.absoluteFill, { opacity: opacity * 0.6 }]}
          contentFit="cover"
          blurRadius={18}
          transition={0}
          cachePolicy="memory-disk"
          recyclingKey={uri}
        />
      )}
      <Image
        source={{ uri }}
        style={[StyleSheet.absoluteFill, { opacity }]}
        contentFit={letterbox ? 'contain' : 'cover'}
        transition={transitionMs}
        onLoad={onLoad}
        // Keep covers in the memory cache (not just disk) so scrolling back up is
        // instant, and key the image by uri so FlashList cell recycling swaps the
        // source cleanly instead of flashing the previous cover during reuse.
        cachePolicy="memory-disk"
        recyclingKey={uri}
      />
    </>
  );
}
