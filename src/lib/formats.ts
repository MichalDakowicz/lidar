import type { Format } from '@/types/book';

/**
 * The formats a book can be owned in, in shelf order. One table so the chips,
 * the filter facets, the card badges and the stats breakdown can never disagree
 * about the list.
 *
 * Free text in Postgres (books.formats is text[]), not an enum: the list lives
 * here and gains entries faster than a Postgres type should be altered.
 *
 * No icons here on purpose — `lib/` stays free of React and react-native so the
 * pure rules are testable (and usable from a node script) without a renderer.
 * The glyph for each format lives in components/media/Glyphs.
 */
export const FORMATS: { value: Format; label: string }[] = [
  { value: 'Hardcover', label: 'Hardcover' },
  { value: 'Paperback', label: 'Paperback' },
  { value: 'Ebook', label: 'Ebook' },
  { value: 'Audiobook', label: 'Audiobook' },
];

const VALUES = new Set<Format>(FORMATS.map((format) => format.value));

export function isFormat(value: string): value is Format {
  return VALUES.has(value as Format);
}

/**
 * Coerces whatever a row holds into the format list. An import can write a
 * single string (`format: "Paperback"`), and a row with nothing at all means
 * Paperback — it is what most of a shelf is, and leaving the list empty would
 * blank the format facet for every book that came in without one.
 */
export function normalizeFormats(raw: unknown): Format[] {
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const seen = new Set<Format>();
  for (const entry of list) {
    const value = String(entry).trim();
    if (isFormat(value)) seen.add(value);
  }
  if (seen.size === 0) return ['Paperback'];
  // Returned in shelf order rather than write order, so two books owned on the
  // same media always render their badges the same way round.
  return FORMATS.filter((format) => seen.has(format.value)).map((format) => format.value);
}

export function formatsToDisplayString(formats: Format[]): string {
  return formats.join(' • ');
}
