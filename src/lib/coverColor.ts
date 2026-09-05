/**
 * The look of a generated cover, derived from the book's own key.
 *
 * Deterministic on purpose: the same book gets the same colour on every device
 * and after every reinstall. A random colour per render would make a grid of
 * coverless books flicker, and two copies of one title would not look like the
 * same book.
 *
 * Pure, so the palette rules are testable without a renderer.
 */

/** FNV-1a, 32-bit. Small, stable, and no dependency. */
export function hashKey(key: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < key.length; i += 1) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export type CoverPalette = { background: string; accent: string; text: string };

/**
 * Hues are spread around the wheel but the saturation and lightness are pinned,
 * so every generated cover sits at the same weight beside the real jackets
 * around it. Dark and desaturated: a wall of bright rectangles would pull the
 * eye away from the books that do have art.
 */
export function coverPalette(bookKey: string): CoverPalette {
  const hue = hashKey(bookKey) % 360;
  return {
    background: `hsl(${hue} 32% 22%)`,
    accent: `hsl(${hue} 45% 62%)`,
    text: `hsl(${hue} 25% 92%)`,
  };
}

/**
 * A long title is unreadable at grid size, so it is trimmed on a word boundary
 * rather than mid-word — "The Left Hand of…" reads; "The Left Han…" looks like
 * a bug.
 */
export function coverTitle(title: string, maxChars = 42): string {
  const clean = title.trim();
  if (clean.length <= maxChars) return clean;
  const cut = clean.slice(0, maxChars);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > maxChars * 0.5 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}
