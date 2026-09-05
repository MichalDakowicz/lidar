import { progressRatio } from '@/lib/pages';
import type { Book, BookStatus } from '@/types/book';

/**
 * Where a book sits in your reading life. Four mutually exclusive states, and
 * nothing about owning a copy: Lidar follows Radar's Watchlist/Watched shape
 * rather than Sonar's Library/Wishlist one, because a book is something you
 * read, not an object you keep.
 *
 * `Readlist` is the plan, `Reading` is the one on the nightstand right now,
 * `Read` is finished, `Did not finish` is put down on purpose — which is worth
 * recording rather than pretending the book is still in progress.
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
  { value: 'Readlist', label: 'Readlist', color: '#3b82f6', tint: 'rgba(59,130,246,0.16)' },
  { value: 'Reading', label: 'Reading', color: '#22c55e', tint: 'rgba(34,197,94,0.16)' },
  { value: 'Read', label: 'Read', color: '#8B5CF6', tint: 'rgba(139,92,246,0.16)' },
  { value: 'Did not finish', label: 'Did not finish', color: '#a3a3a3', tint: 'rgba(163,163,163,0.16)' },
];

const BY_VALUE = new Map(STATUSES.map((status) => [status.value, status]));

/**
 * Statuses Lidar 0.1 wrote, which an old export can still carry. They were
 * about owning a copy, so none of them says whether the book was read — the
 * honest landing place for all three is the readlist. A caller that knows more
 * (dataTransfer, which can see `lastReadAt`) upgrades from there.
 */
const RETIRED: Record<string, BookStatus> = {
  Library: 'Readlist',
  Wishlist: 'Readlist',
  'Pre-order': 'Readlist',
};

export function statusMeta(status: BookStatus) {
  return BY_VALUE.get(status) ?? STATUSES[0];
}

/**
 * A row written without a status is a book you have not read yet — that is what
 * importing someone's list of books means, so an absent value reads as
 * `Readlist` rather than as unknown.
 */
export function normalizeStatus(raw: unknown): BookStatus {
  const value = typeof raw === 'string' ? raw.trim() : '';
  if (BY_VALUE.has(value as BookStatus)) return value as BookStatus;
  return RETIRED[value] ?? 'Readlist';
}

/** A plan, not a book you have opened. */
export function isReadlist(book: Book): boolean {
  return book.status === 'Readlist';
}

export function isReading(book: Book): boolean {
  return book.status === 'Reading';
}

export function isRead(book: Book): boolean {
  return book.status === 'Read';
}

/**
 * Anything you have actually opened — read, reading, or put down. The
 * counterpart to the readlist, and what every "your books" number counts.
 */
export function isStarted(book: Book): boolean {
  return book.status !== 'Readlist';
}

/**
 * How far through the book you are, 0–1, or null when there is nothing to draw
 * a bar from. Guarded against a `current_page` past the page count, which an
 * edition mismatch makes easy (the hardcover you logged against the paperback's
 * page total), and measured from `start_page` so front matter is not progress.
 */
export function readingProgress(book: Book): number | null {
  return progressRatio(book);
}
