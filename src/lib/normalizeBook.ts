import { authorList, bookKey } from '@/lib/bookKey';
import { normalizeStatus } from '@/lib/bookStatus';
import { cleanIsbn } from '@/lib/isbn';
import type { Book, BookRating, Ratings, Read } from '@/types/book';

// Raw shape of a row from public.books (supabase/schema.sql).
export type BookRow = {
  id: string;
  user_id: string;
  isbn13: string | null;
  isbn10: string | null;
  google_id: string | null;
  book_key: string | null;
  title: string;
  subtitle: string | null;
  authors: unknown;
  cover_url: string | null;
  published_date: string | null;
  page_count: number | null;
  publisher: string | null;
  language: string | null;
  series: string | null;
  series_index: number | string | null;
  genres: unknown;
  description: string | null;
  url: string | null;
  status: string | null;
  notes: string | null;
  favorite_quotes: string | null;
  current_page: number | null;
  progress_updated_at: string | null;
  custom_order: number | null;
  last_read_at: string | null;
  added_at: string;
  updated_at: string;
  // Retired in 0.2.0 when ownership was dropped. The columns are still there —
  // supabase/schema.sql never drops one — and an old export still carries them,
  // but nothing app-side reads them any more.
  formats?: unknown;
  acquisition_date?: string | null;
  store_name?: string | null;
  price_paid?: number | string | null;
  edition?: string | null;
};

function stringList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((entry) => String(entry).trim()).filter(Boolean);
}

/** numeric columns come back as strings from PostgREST when they are wide. */
function numberOrNull(raw: number | string | null): number | null {
  if (raw == null || raw === '') return null;
  const value = typeof raw === 'number' ? raw : parseFloat(raw);
  return Number.isFinite(value) ? value : null;
}

/**
 * The single read boundary: every screen consumes `Book`, never a raw row.
 * Coerces the loose shapes an import can write (a single-string author, a
 * retired status) so a row can never render in an
 * inconsistent state, and back-fills book_key for rows written before it
 * existed — the rating join depends on it never being null in app-land.
 */
export function normalizeBook(row: BookRow): Book {
  const authors = authorList(row.authors as string[] | string | null);
  const isbn13 = row.isbn13 ? cleanIsbn(row.isbn13) : null;

  return {
    id: row.id,
    userId: row.user_id,
    isbn13,
    isbn10: row.isbn10 ? cleanIsbn(row.isbn10) : null,
    googleId: row.google_id,
    bookKey: row.book_key || bookKey({ isbn13, googleId: row.google_id, title: row.title, authors }),
    title: row.title,
    subtitle: row.subtitle ?? '',
    authors,
    coverUrl: row.cover_url,
    publishedDate: row.published_date,
    pageCount: row.page_count,
    publisher: row.publisher ?? '',
    language: row.language ?? '',
    series: row.series ?? '',
    seriesIndex: numberOrNull(row.series_index),
    genres: stringList(row.genres),
    description: row.description ?? '',
    url: row.url ?? '',
    status: normalizeStatus(row.status),
    notes: row.notes ?? '',
    favoriteQuotes: row.favorite_quotes ?? '',
    currentPage: row.current_page,
    progressUpdatedAt: row.progress_updated_at,
    customOrder: row.custom_order,
    lastReadAt: row.last_read_at,
    addedAt: row.added_at,
    updatedAt: row.updated_at,
  };
}

// Partial camelCase Book -> snake_case columns, for writes. Only maps keys that
// are present, so callers can pass a sparse update (every write also runs
// through stripUndefined).
const FIELD_MAP: Record<string, string> = {
  isbn13: 'isbn13',
  isbn10: 'isbn10',
  googleId: 'google_id',
  bookKey: 'book_key',
  title: 'title',
  subtitle: 'subtitle',
  authors: 'authors',
  coverUrl: 'cover_url',
  publishedDate: 'published_date',
  pageCount: 'page_count',
  publisher: 'publisher',
  language: 'language',
  series: 'series',
  seriesIndex: 'series_index',
  genres: 'genres',
  description: 'description',
  url: 'url',
  status: 'status',
  notes: 'notes',
  favoriteQuotes: 'favorite_quotes',
  currentPage: 'current_page',
  progressUpdatedAt: 'progress_updated_at',
  customOrder: 'custom_order',
  lastReadAt: 'last_read_at',
  updatedAt: 'updated_at',
};

/** Columns Postgres rejects an empty string for — a blank form field is null. */
const NULL_ON_EMPTY = new Set(['page_count', 'series_index', 'current_page']);

export function toBookRow(book: Partial<Book>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(book)) {
    const column = FIELD_MAP[key];
    if (!column) continue;
    row[column] = value === '' && NULL_ON_EMPTY.has(column) ? null : value;
  }
  return row;
}

export type ReadRow = {
  id: string;
  user_id: string;
  book_id: string | null;
  book_key: string | null;
  title: string;
  authors: unknown;
  cover_url: string | null;
  started_at: string | null;
  finished_at: string;
  page_count: number | null;
};

export function normalizeRead(row: ReadRow): Read {
  return {
    id: row.id,
    userId: row.user_id,
    bookId: row.book_id,
    bookKey: row.book_key,
    title: row.title,
    authors: authorList(row.authors as string[] | string | null),
    coverUrl: row.cover_url,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    pageCount: row.page_count,
  };
}

export type BookRatingRow = {
  user_id: string;
  book_key: string;
  isbn13: string | null;
  title: string;
  authors: unknown;
  cover_url: string | null;
  published_date: string | null;
  ratings: Ratings | null;
  review: string | null;
  created_at: string;
  updated_at: string;
};

export function normalizeRating(row: BookRatingRow): BookRating {
  return {
    userId: row.user_id,
    bookKey: row.book_key,
    isbn13: row.isbn13,
    title: row.title,
    authors: authorList(row.authors as string[] | string | null),
    coverUrl: row.cover_url,
    publishedDate: row.published_date,
    ratings: row.ratings ?? {},
    review: row.review ?? '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
