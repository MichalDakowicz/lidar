import { Text, View } from 'react-native';

import { coverPalette, coverTitle } from '@/lib/coverColor';
import { authorsToDisplayString } from '@/lib/utils';

/**
 * A cover drawn from the book's own details, for the books no catalogue has a
 * jacket for.
 *
 * Neither Polish source publishes cover art — the national bibliography and the
 * ISBN register are bibliographic records, not shop listings — and Open Library
 * has no image for these either. So a Polish book used to render as a grey
 * glyph, which reads as a loading failure rather than as a fact about the
 * catalogue. This says "we know exactly which book this is, nobody has a
 * picture of it" instead.
 *
 * Sized off the tile rather than a fixed scale: the same component fills a
 * 110px stats thumbnail and a 200px grid card, and text that ignored the box
 * would overflow one of them.
 */
type GeneratedCoverProps = {
  bookKey: string;
  title: string;
  authors: string[];
  /** Measured tile width, so the type scales with the card. */
  width?: number;
};

export function GeneratedCover({ bookKey, title, authors, width = 140 }: GeneratedCoverProps) {
  const palette = coverPalette(bookKey);
  const compact = width < 96;
  const titleSize = Math.max(9, Math.min(19, Math.round(width * 0.115)));
  const authorSize = Math.max(8, Math.round(titleSize * 0.66));
  const padding = Math.max(6, Math.round(width * 0.09));
  const authorLine = authorsToDisplayString(authors);

  return (
    <View className="absolute inset-0 justify-between" style={{ backgroundColor: palette.background, padding }}>
      {/* A spine rule down the left: the one mark that reads as "book" at any
          size, and it survives the tile being 60px wide in a carousel. */}
      <View
        className="absolute bottom-0 left-0 top-0"
        style={{ width: Math.max(2, Math.round(width * 0.022)), backgroundColor: palette.accent, opacity: 0.85 }}
      />

      <Text
        numberOfLines={compact ? 3 : 5}
        style={{ color: palette.text, fontSize: titleSize, lineHeight: titleSize * 1.22, fontWeight: '700' }}
      >
        {coverTitle(title, compact ? 28 : 60)}
      </Text>

      {!!authorLine && !compact && (
        <Text numberOfLines={2} style={{ color: palette.accent, fontSize: authorSize, fontWeight: '600' }}>
          {authorLine}
        </Text>
      )}
    </View>
  );
}
