import { bookKey } from '@/lib/bookKey';
import { cleanIsbn, parseIsbn } from '@/lib/isbn';

import type { BookResult, IsbnProvider } from './types';

/**
 * Google Books — the widest catalogue, and the one with the covers and page
 * counts. Keyless: the `volumes` endpoint answers anonymous requests.
 *
 * `EXPO_PUBLIC_GOOGLE_BOOKS_KEY` is optional and only raises the per-IP quota.
 * Set it if lookups start coming back 429 — the anonymous quota is shared with
 * every other unauthenticated caller on the same address, so it does run out.
 */

const API_KEY = process.env.EXPO_PUBLIC_GOOGLE_BOOKS_KEY;
const GOOGLE_API = 'https://www.googleapis.com/books/v1';

/** Google's two orderings. `newest` is the only way to ask for recent books. */
export type BrowseSort = 'relevance' | 'newest';

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

export async function googleVolumes(query: string, limit: number, orderBy: BrowseSort = 'relevance'): Promise<BookResult[]> {
  const params = new URLSearchParams({
    q: query,
    maxResults: String(Math.min(limit, 40)),
    orderBy,
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

/** Full volume detail for a book already identified by its Google id. */
export async function fetchVolume(googleId: string): Promise<BookResult | null> {
  const params = new URLSearchParams();
  if (API_KEY) params.set('key', API_KEY);

  const response = await fetch(`${GOOGLE_API}/volumes/${googleId}?${params.toString()}`);
  if (!response.ok) return null;

  return volumeToResult((await response.json()) as GoogleVolume);
}

export const googleBooks: IsbnProvider = {
  name: 'Google Books',
  lookup: async (isbn13, isbn10) => {
    // The `isbn:` qualifier rather than free text: a bare number matches any
    // volume that merely *mentions* it — a bibliography, a publisher's
    // catalogue — and the first such hit is not the book in your hand.
    const [byThirteen] = await googleVolumes(`isbn:${isbn13}`, 1);
    if (byThirteen) return byThirteen;
    // Some Google records are indexed only under the ISBN-10 of the same edition.
    if (!isbn10) return null;
    const [byTen] = await googleVolumes(`isbn:${isbn10}`, 1);
    return byTen ?? null;
  },
};
