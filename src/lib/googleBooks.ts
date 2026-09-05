import { bookKey } from '@/lib/bookKey';
import { cleanIsbn, isValidIsbn10, isValidIsbn13, parseIsbn } from '@/lib/isbn';

/**
 * Book metadata, keyless.
 *
 * Where Sonar needs a Spotify client id and secret in `.env`, Lidar needs
 * nothing: Google Books' `volumes` endpoint answers anonymous requests, and
 * Open Library is open by definition. That is why there is no token cache and
 * no NotConfiguredError in this file — there is nothing to configure and
 * nothing to fail on.
 *
 * Two providers, in this order:
 *   1. Google Books — better covers, page counts and categories.
 *   2. Open Library — catches editions Google does not have, which in practice
 *      means older and non-English printings, exactly the ones a barcode scan
 *      of a second-hand book tends to hit.
 *
 * An API key is optional and only raises the per-IP quota. Set
 * EXPO_PUBLIC_GOOGLE_BOOKS_KEY if searches start coming back 429.
 */

const API_KEY = process.env.EXPO_PUBLIC_GOOGLE_BOOKS_KEY;

const GOOGLE_API = 'https://www.googleapis.com/books/v1';
const OPENLIBRARY_API = 'https://openlibrary.org';

export type BookResult = {
  isbn13: string | null;
  isbn10: string | null;
  googleId: string | null;
  bookKey: string;
  title: string;
  subtitle: string;
  authors: string[];
  coverUrl: string | null;
  publishedDate: string | null;
  pageCount: number | null;
  publisher: string;
  language: string;
  genres: string[];
  description: string;
  url: string;
};

// ---------------------------------------------------------------------------
// Google Books
// ---------------------------------------------------------------------------

type GoogleVolume = {
  id: string;
  volumeInfo?: {
    title?: string;
    subtitle?: string;
    authors?: string[];
    publisher?: string;
    publishedDate?: string;
    description?: string;
    pageCount?: number;
    categories?: string[];
    language?: string;
    infoLink?: string;
    previewLink?: string;
    imageLinks?: Record<string, string>;
    industryIdentifiers?: { type: string; identifier: string }[];
  };
};

/**
 * Google's thumbnails come back as http with a `zoom=1` edge curl. Upgrading to
 * https is not cosmetic — Android blocks cleartext by default, so the http URL
 * renders as a blank cover; and dropping `edge=curl` removes a fake page-fold
 * graphic drawn onto the image, which looks like a rendering bug beside a real
 * cover.
 */
function coverFromLinks(links: Record<string, string> | undefined): string | null {
  const raw = links?.extraLarge ?? links?.large ?? links?.medium ?? links?.thumbnail ?? links?.smallThumbnail;
  if (!raw) return null;
  return raw.replace(/^http:/, 'https:').replace(/&edge=curl/, '').replace(/zoom=\d/, 'zoom=2');
}

function volumeToResult(volume: GoogleVolume): BookResult {
  const info = volume.volumeInfo ?? {};
  const ids = info.industryIdentifiers ?? [];

  const rawIsbn13 = ids.find((id) => id.type === 'ISBN_13')?.identifier ?? null;
  const rawIsbn10 = ids.find((id) => id.type === 'ISBN_10')?.identifier ?? null;
  // Normalise through parseIsbn so a 10 with no 13 beside it still yields the
  // 13-digit form the key is built from.
  const parsed = parseIsbn(rawIsbn13 ?? rawIsbn10);

  const authors = (info.authors ?? []).map((a) => a.trim()).filter(Boolean);
  const title = info.title?.trim() || 'Untitled';

  return {
    isbn13: parsed?.isbn13 ?? null,
    isbn10: parsed?.isbn10 ?? (rawIsbn10 ? cleanIsbn(rawIsbn10) : null),
    googleId: volume.id,
    bookKey: bookKey({ isbn13: parsed?.isbn13, googleId: volume.id, title, authors }),
    title,
    subtitle: info.subtitle?.trim() ?? '',
    authors,
    coverUrl: coverFromLinks(info.imageLinks),
    publishedDate: info.publishedDate ?? null,
    pageCount: typeof info.pageCount === 'number' && info.pageCount > 0 ? info.pageCount : null,
    publisher: info.publisher?.trim() ?? '',
    language: info.language ?? '',
    genres: (info.categories ?? []).map((c) => c.trim()).filter(Boolean),
    description: info.description?.trim() ?? '',
    url: info.infoLink ?? info.previewLink ?? '',
  };
}

async function googleVolumes(query: string, limit: number): Promise<BookResult[]> {
  const params = new URLSearchParams({
    q: query,
    maxResults: String(Math.min(limit, 40)),
    printType: 'books',
    // Ask for the fields we read, so a search response is a few KB rather than
    // a few hundred — this runs per keystroke behind a debounce.
    fields: 'items(id,volumeInfo(title,subtitle,authors,publisher,publishedDate,description,pageCount,categories,language,infoLink,previewLink,imageLinks,industryIdentifiers))',
  });
  if (API_KEY) params.set('key', API_KEY);

  const response = await fetch(`${GOOGLE_API}/volumes?${params.toString()}`);
  if (!response.ok) throw new Error(`Google Books search failed (${response.status})`);

  const body = (await response.json()) as { items?: GoogleVolume[] };
  return (body.items ?? []).map(volumeToResult);
}

// ---------------------------------------------------------------------------
// Open Library — the fallback, and the only provider for some old printings
// ---------------------------------------------------------------------------

type OpenLibraryEdition = {
  title?: string;
  subtitle?: string;
  authors?: { name?: string }[];
  publishers?: { name?: string }[];
  publish_date?: string;
  number_of_pages?: number;
  subjects?: { name?: string }[];
  cover?: { large?: string; medium?: string; small?: string };
  url?: string;
};

function openLibraryToResult(isbn13: string, isbn10: string | null, edition: OpenLibraryEdition): BookResult {
  const authors = (edition.authors ?? []).map((a) => a.name?.trim() ?? '').filter(Boolean);
  const title = edition.title?.trim() || 'Untitled';

  return {
    isbn13,
    isbn10,
    googleId: null,
    bookKey: bookKey({ isbn13, title, authors }),
    title,
    subtitle: edition.subtitle?.trim() ?? '',
    authors,
    coverUrl: edition.cover?.large ?? edition.cover?.medium ?? edition.cover?.small ?? null,
    publishedDate: edition.publish_date ?? null,
    pageCount: edition.number_of_pages ?? null,
    publisher: edition.publishers?.[0]?.name?.trim() ?? '',
    language: '',
    genres: (edition.subjects ?? []).slice(0, 6).map((s) => s.name?.trim() ?? '').filter(Boolean),
    description: '',
    url: edition.url ?? `${OPENLIBRARY_API}/isbn/${isbn13}`,
  };
}

async function openLibraryByIsbn(isbn13: string, isbn10: string | null): Promise<BookResult | null> {
  const response = await fetch(
    `${OPENLIBRARY_API}/api/books?bibkeys=ISBN:${isbn13}&jscmd=data&format=json`,
  );
  if (!response.ok) return null;

  const body = (await response.json()) as Record<string, OpenLibraryEdition>;
  const edition = body[`ISBN:${isbn13}`];
  return edition ? openLibraryToResult(isbn13, isbn10, edition) : null;
}

// ---------------------------------------------------------------------------
// The two entry points the app uses
// ---------------------------------------------------------------------------

/** Free-text search: title, author, whatever was typed. */
export async function searchBooks(query: string, limit = 20): Promise<BookResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  // A search box that happens to receive an ISBN should behave like a scan.
  const parsed = parseIsbn(trimmed);
  if (parsed) {
    const found = await lookupIsbn(parsed.isbn13);
    return found ? [found] : [];
  }

  return googleVolumes(trimmed, limit);
}

/**
 * The scanner's lookup: one ISBN in, one book or null out.
 *
 * Google is asked with the `isbn:` qualifier rather than as free text, because
 * a bare number matches any volume that merely *mentions* it — a bibliography,
 * a publisher's catalogue — and the first such hit is not the book in your hand.
 *
 * A miss on both providers is a real outcome, not an error: plenty of editions
 * are in neither catalogue, and the caller's answer to null is to open the
 * manual form with the ISBN already filled in.
 */
export async function lookupIsbn(raw: string): Promise<BookResult | null> {
  const parsed = parseIsbn(raw);
  if (!parsed) return null;

  try {
    const [byThirteen] = await googleVolumes(`isbn:${parsed.isbn13}`, 1);
    if (byThirteen) return { ...byThirteen, isbn13: parsed.isbn13, isbn10: parsed.isbn10 };
  } catch {
    // Fall through to Open Library — a Google outage or a 429 must not stop a
    // scan that Open Library can answer.
  }

  // Some Google records are indexed only under the ISBN-10 of the same edition.
  if (parsed.isbn10) {
    try {
      const [byTen] = await googleVolumes(`isbn:${parsed.isbn10}`, 1);
      if (byTen) return { ...byTen, isbn13: parsed.isbn13, isbn10: parsed.isbn10 };
    } catch {
      // Same as above.
    }
  }

  try {
    return await openLibraryByIsbn(parsed.isbn13, parsed.isbn10);
  } catch {
    return null;
  }
}

/** Full volume detail for a book already identified by its Google id. */
export async function fetchVolume(googleId: string): Promise<BookResult | null> {
  const params = new URLSearchParams();
  if (API_KEY) params.set('key', API_KEY);

  const response = await fetch(`${GOOGLE_API}/volumes/${googleId}?${params.toString()}`);
  if (!response.ok) return null;

  return volumeToResult((await response.json()) as GoogleVolume);
}

/** Re-exported so callers do not have to reach into lib/isbn for the guard. */
export { isValidIsbn10, isValidIsbn13 };
