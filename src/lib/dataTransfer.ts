import { authorList, bookKey, isbnFromKey } from '@/lib/bookKey';
import { parseIsbn } from '@/lib/isbn';
import { normalizeStatus } from '@/lib/bookStatus';
import { normalizeFormats } from '@/lib/formats';
import type { Book, BookRating, Ratings, Read } from '@/types/book';

// Stable import/export format. The payload is versioned so future shape
// changes stay backwards-readable, and it carries all three of the things that
// are yours: the library, the ratings (which can outlive an book row) and
// the read log. Identity fields (`id`, `userId`) are dropped — they are
// re-minted per account on import.
//
// It also reads an export produced by either sibling app, so a shelf exported
// from one shape imports here without hand conversion.

export const EXPORT_VERSION = 2;

export type PortableBook = Omit<Partial<Book>, 'id' | 'userId'> & { title: string };
export type PortableRating = Omit<BookRating, 'userId' | 'createdAt' | 'updatedAt'>;
export type PortableRead = Omit<Read, 'id' | 'userId' | 'bookId'> & { bookKey: string | null };

export type ExportPayload = {
  version: number;
  exportedAt: string;
  counts: { books: number; ratings: number; reads: number };
  books: PortableBook[];
  ratings: PortableRating[];
  reads: PortableRead[];
};

export function buildExportPayload(
  books: Book[],
  ratings: BookRating[],
  reads: Read[],
  exportedAt: string,
): ExportPayload {
  return {
    version: EXPORT_VERSION,
    exportedAt,
    counts: { books: books.length, ratings: ratings.length, reads: reads.length },
    books: books.map(({ id: _id, userId: _userId, ...rest }) => rest),
    ratings: ratings.map(({ userId: _userId, createdAt: _createdAt, updatedAt: _updatedAt, ...rest }) => rest),
    reads: reads.map(({ id: _id, userId: _userId, bookId: _bookId, ...rest }) => rest),
  };
}

export function serializeExport(books: Book[], ratings: BookRating[], reads: Read[], exportedAt: string): string {
  return JSON.stringify(buildExportPayload(books, ratings, reads, exportedAt), null, 2);
}

export type ParseResult = {
  books: PortableBook[];
  ratings: PortableRating[];
  reads: PortableRead[];
  errors: string[];
};

function numberOrUndefined(raw: unknown): number | undefined {
  if (raw == null || raw === '') return undefined;
  const value = typeof raw === 'number' ? raw : parseFloat(String(raw));
  return Number.isFinite(value) ? value : undefined;
}

/** Firebase wrote epoch millis; Postgres wants ISO. Accepts either. */
function isoOrUndefined(raw: unknown): string | undefined {
  if (typeof raw === 'number') return new Date(raw).toISOString();
  if (typeof raw === 'string' && raw.trim()) {
    const parsed = Date.parse(raw);
    return Number.isNaN(parsed) ? undefined : new Date(parsed).toISOString();
  }
  return undefined;
}

function coerceRatings(raw: unknown): Ratings | undefined {
  // The legacy app had a single `rating` number; the facets did not exist yet,
  // so it reads as the overall score and the breakdown stays empty.
  if (typeof raw === 'number' && raw > 0) return { overall: raw };
  if (!raw || typeof raw !== 'object') return undefined;
  const source = raw as Record<string, unknown>;
  const out: Ratings = {};
  for (const key of ['prose', 'plot', 'characters', 'replay', 'overall'] as const) {
    const value = numberOrUndefined(source[key]);
    if (value != null && value > 0) out[key] = value;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function coerceBook(item: Record<string, unknown>, index: number, errors: string[]): PortableBook | null {
  const title = typeof item.title === 'string' ? item.title.trim() : '';
  if (!title) {
    errors.push(`Book ${index + 1}: missing title, skipped`);
    return null;
  }

  const authors = authorList((item.authors as string[] | string | null) ?? null);
  const googleId = typeof item.googleId === 'string' ? item.googleId : null;

  return {
    title,
    authors,
    googleId,
    bookKey:
      typeof item.bookKey === 'string' && item.bookKey ? item.bookKey : bookKey({ googleId, title, authors }),
    coverUrl: typeof item.coverUrl === 'string' ? item.coverUrl : null,
    publishedDate: typeof item.publishedDate === 'string' ? item.publishedDate : null,
    pageCount: numberOrUndefined(item.pageCount) ?? null,
    genres: Array.isArray(item.genres) ? item.genres.map(String) : [],
    // Legacy key was `format` (sometimes a bare string), current is `formats`.
    formats: normalizeFormats(item.formats ?? item.format),
    status: normalizeStatus(item.status),
    url: typeof item.url === 'string' ? item.url : '',
    notes: typeof item.notes === 'string' ? item.notes : '',
    favoriteQuotes: typeof item.favoriteQuotes === 'string' ? item.favoriteQuotes : '',
    acquisitionDate: typeof item.acquisitionDate === 'string' && item.acquisitionDate ? item.acquisitionDate : null,
    storeName: typeof item.storeName === 'string' ? item.storeName : '',
    pricePaid: numberOrUndefined(item.pricePaid) ?? null,
    edition: typeof item.edition === 'string' ? item.edition : '',
    customOrder: numberOrUndefined(item.customOrder) ?? null,
    lastReadAt: isoOrUndefined(item.lastReadAt ?? item.lastListened) ?? null,
    addedAt: isoOrUndefined(item.addedAt) ?? new Date().toISOString(),
  };
}

/**
 * Accepts a Lidar export ({ version, books, … }), a bare array of books, or
 * the legacy Firebase user export ({ books: {...}, history: {...} }) where
 * both librarys are keyed objects rather than arrays.
 */
export function parseImport(text: string): ParseResult {
  const errors: string[] = [];
  const trimmed = text.trim();
  if (!trimmed) return { books: [], ratings: [], reads: [], errors: ['Nothing to import — paste or pick a JSON file first.'] };

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return { books: [], ratings: [], reads: [], errors: ['Invalid JSON — expected a Lidar export file or an array of books.'] };
  }

  const booksRaw = collect(parsed, 'books');
  const ratingsRaw = collect(parsed, 'ratings');
  // Legacy calls the log "history", the current format calls it "reads".
  const readsRaw = [...(collect(parsed, 'history') ?? []), ...(collect(parsed, 'reads') ?? [])];

  if (!booksRaw && !ratingsRaw && readsRaw.length === 0) {
    return { books: [], ratings: [], reads: [], errors: ['Unrecognised JSON shape — expected a Lidar export or an array of books.'] };
  }

  const books: PortableBook[] = [];
  (booksRaw ?? []).forEach((raw, index) => {
    if (!raw || typeof raw !== 'object') {
      errors.push(`Book ${index + 1}: not an object, skipped`);
      return;
    }
    const coerced = coerceBook(raw as Record<string, unknown>, index, errors);
    if (coerced) books.push(coerced);
  });

  // A legacy export carries its ratings on the book rows themselves, so those
  // become rating rows here — that is what makes an old backup keep its scores.
  const ratings: PortableRating[] = [];
  (booksRaw ?? []).forEach((raw) => {
    if (!raw || typeof raw !== 'object') return;
    const item = raw as Record<string, unknown>;
    const scores = coerceRatings(item.ratings ?? item.rating);
    if (!scores) return;
    const authors = authorList((item.authors as string[] | string | null) ?? null);
    const googleId = typeof item.googleId === 'string' ? item.googleId : null;
    const isbn13 = parseIsbn(item.isbn13 as string | null)?.isbn13 ?? null;
    const title = typeof item.title === 'string' ? item.title.trim() : '';
    if (!title) return;
    const key = typeof item.bookKey === 'string' && item.bookKey ? item.bookKey : bookKey({ isbn13, googleId, title, authors });
    ratings.push({
      bookKey: key,
      isbn13: isbn13 ?? isbnFromKey(key),
      title,
      authors,
      coverUrl: typeof item.coverUrl === 'string' ? item.coverUrl : null,
      publishedDate: typeof item.publishedDate === 'string' ? item.publishedDate : null,
      ratings: scores,
      review: typeof item.review === 'string' ? item.review : '',
    });
  });

  (ratingsRaw ?? []).forEach((raw, index) => {
    if (!raw || typeof raw !== 'object') return;
    const item = raw as Record<string, unknown>;
    const title = typeof item.title === 'string' ? item.title.trim() : '';
    const key = typeof item.bookKey === 'string' ? item.bookKey : '';
    const scores = coerceRatings(item.ratings);
    if (!title || !key || !scores) {
      errors.push(`Rating ${index + 1}: incomplete, skipped`);
      return;
    }
    // An explicit rating row wins over one reconstructed from an book row.
    const existing = ratings.findIndex((rating) => rating.bookKey === key);
    const row: PortableRating = {
      bookKey: key,
      isbn13: parseIsbn(item.isbn13 as string | null)?.isbn13 ?? isbnFromKey(key),
      title,
      authors: authorList((item.authors as string[] | string | null) ?? null),
      coverUrl: typeof item.coverUrl === 'string' ? item.coverUrl : null,
      publishedDate: typeof item.publishedDate === 'string' ? item.publishedDate : null,
      ratings: scores,
      review: typeof item.review === 'string' ? item.review : '',
    };
    if (existing >= 0) ratings[existing] = row;
    else ratings.push(row);
  });

  const reads: PortableRead[] = [];
  readsRaw.forEach((raw, index) => {
    if (!raw || typeof raw !== 'object') return;
    const item = raw as Record<string, unknown>;
    const finishedAt = isoOrUndefined(item.finishedAt ?? item.timestamp);
    const title = typeof item.title === 'string' ? item.title.trim() : '';
    if (!finishedAt || !title) {
      errors.push(`Read ${index + 1}: missing title or date, skipped`);
      return;
    }
    reads.push({
      bookKey: typeof item.bookKey === 'string' ? item.bookKey : null,
      title,
      authors: authorList((item.authors as string[] | string | null) ?? null),
      coverUrl: typeof item.coverUrl === 'string' ? item.coverUrl : null,
      startedAt: isoOrUndefined(item.startedAt) ?? null,
      finishedAt,
      pageCount: numberOrUndefined(item.pageCount) ?? null,
    });
  });

  return { books, ratings, reads, errors };
}

/** Arrays and Firebase's keyed objects both read as a list. */
function collect(parsed: unknown, key: string): Record<string, unknown>[] | null {
  if (Array.isArray(parsed)) return key === 'books' ? (parsed as Record<string, unknown>[]) : null;
  if (!parsed || typeof parsed !== 'object') return null;
  const value = (parsed as Record<string, unknown>)[key];
  if (Array.isArray(value)) return value as Record<string, unknown>[];
  if (value && typeof value === 'object') return Object.values(value as Record<string, unknown>) as Record<string, unknown>[];
  return null;
}

/**
 * A candidate is already on the shelf when it shares an book key — which is
 * the release identity, so a re-export of the same library imports as zero
 * new rows rather than doubling it.
 */
export function isDuplicate(candidate: PortableBook, existing: Book[]): boolean {
  const key = candidate.bookKey;
  return existing.some((book) => (key ? book.bookKey === key : book.title.toLowerCase() === candidate.title.toLowerCase()));
}
