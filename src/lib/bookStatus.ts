import type { Book, BookStatus } from '@/types/book';

/**
 * Where a book sits on your shelf. Unlike formats these are mutually exclusive.
 * `Library` and `Reading` both mean you have it — every stat that talks about
 * "your library" counts both, because a book you are halfway through is still a
 * book you own, while a wishlist entry is a plan.
 *
 * `Reading` is Lidar's own addition to the sibling apps' three: a record is
 * spun in an evening, a book is lived with for weeks, and the shelf has to be
 * able to say which one is open on the nightstand right now.
 *
 * The colours ride along here (they are data properties of the status, and the
 * cards, chips and pills must agree on them) but the icon does not: `lib/` stays
 * free of React so these rules can be tested without a renderer. Glyphs live in
 * components/media/Glyphs.
 *
 * `tint` is a real colour, not `color + '22'`. That trick only works on hex, and
 * concatenating onto an `hsl(...)` string produces something unparseable, which
 * React Native resolves to an opaque block — a selected chip drawing over its
 * own icon and label.
 */
export const STATUSES: { value: BookStatus; label: string; color: string; tint: string }[] = [
  { value: 'Library', label: 'Library', color: '#8B5CF6', tint: 'rgba(139,92,246,0.16)' },
  { value: 'Reading', label: 'Reading', color: '#22c55e', tint: 'rgba(34,197,94,0.16)' },
  { value: 'Wishlist', label: 'Wishlist', color: '#ec4899', tint: 'rgba(236,72,153,0.16)' },
  { value: 'Pre-order', label: 'Pre-order', color: '#3b82f6', tint: 'rgba(59,130,246,0.16)' },
  { value: 'Did not finish', label: 'Did not finish', color: '#a3a3a3', tint: 'rgba(163,163,163,0.16)' },
];

const BY_VALUE = new Map(STATUSES.map((status) => [status.value, status]));

export function statusMeta(status: BookStatus) {
  return BY_VALUE.get(status) ?? STATUSES[0];
}

/**
 * A row written without a status is a book on the shelf — that is what an
 * import of someone's library means, so an absent value reads as `Library`
 * rather than as unknown.
 */
export function normalizeStatus(raw: unknown): BookStatus {
  const value = typeof raw === 'string' ? raw.trim() : '';
  return BY_VALUE.has(value as BookStatus) ? (value as BookStatus) : 'Library';
}

/** On the shelf: owned outright, or owned and currently open. */
export function isOwned(book: Book): boolean {
  return book.status === 'Library' || book.status === 'Reading' || book.status === 'Did not finish';
}

export function isReading(book: Book): boolean {
  return book.status === 'Reading';
}

export function isWishlist(book: Book): boolean {
  return book.status === 'Wishlist';
}

export function isPreOrder(book: Book): boolean {
  return book.status === 'Pre-order';
}

/**
 * How far through the book you are, 0–1, or null when there is nothing to draw
 * a bar from. Guarded against a `current_page` past the page count, which an
 * edition mismatch makes easy (the hardcover you logged against the paperback's
 * page total).
 */
export function readingProgress(book: Book): number | null {
  if (!book.pageCount || book.pageCount <= 0) return null;
  if (book.currentPage == null || book.currentPage <= 0) return null;
  return Math.min(book.currentPage / book.pageCount, 1);
}
