import { parseIsbn } from '@/lib/isbn';
import { bibliotekaNarodowa, isPolishIsbn } from '@/lib/providers/bibliotekaNarodowa';
import { googleBooks, googleVolumes, type BrowseSort } from '@/lib/providers/googleBooks';
import { openLibrary } from '@/lib/providers/openLibrary';
import type { BookResult, IsbnProvider, ProviderName } from '@/lib/providers/types';

export { fetchVolume } from '@/lib/providers/googleBooks';
export { isValidIsbn10, isValidIsbn13 } from '@/lib/isbn';
export type { BookResult, BrowseSort, ProviderName };

/**
 * Book metadata, keyless, across three catalogues.
 *
 * Where Sonar needs a Spotify client id and secret, Lidar needs nothing: Google
 * Books answers anonymous requests, and Open Library and Biblioteka Narodowa
 * are open by definition. That is why there is no token cache and no
 * NotConfiguredError here.
 *
 * `lookupIsbn` is the single entry point, so the scanner, the search box and the
 * editor's metadata refresh all pick up a new provider for free.
 */

/**
 * **Polish-first for Polish ISBNs.** An ISBN-13 beginning `97883` is the Polish
 * registration group, and for those books Google and Open Library are usually
 * two guaranteed misses before the catalogue that actually has to hold it —
 * Poland has legal deposit, so BN does. Putting BN first for `978-83-…` makes
 * the common case one request instead of three; everything else keeps Google
 * first, where the covers and the descriptions are.
 */
export function providersFor(isbn13: string): IsbnProvider[] {
  return isPolishIsbn(isbn13)
    ? [bibliotekaNarodowa, googleBooks, openLibrary]
    : [googleBooks, openLibrary, bibliotekaNarodowa];
}

/**
 * The scanner's lookup: one ISBN in, one book or null out.
 *
 * A provider that throws never stops the chain — a Google 429 must not fail a
 * scan Open Library or BN can answer. A miss everywhere is a real outcome, not
 * an error: plenty of editions are in no catalogue, and the caller's answer to
 * null is the manual form with the ISBN already filled in.
 */
export async function lookupIsbn(raw: string): Promise<BookResult | null> {
  const parsed = parseIsbn(raw);
  if (!parsed) return null;

  let found: BookResult | null = null;

  for (const provider of providersFor(parsed.isbn13)) {
    try {
      const result = await provider.lookup(parsed.isbn13, parsed.isbn10);
      if (result) {
        found = { ...result, isbn13: parsed.isbn13, isbn10: parsed.isbn10, source: provider.name };
        break;
      }
    } catch {
      // Next catalogue. An outage is not an answer.
    }
  }

  if (!found) return null;
  return found.coverUrl ? found : withBorrowedCover(found, parsed.isbn13, parsed.isbn10);
}

/**
 * BN holds no jacket art at all, so a Polish book resolved there would render
 * with correct metadata and a blank cover — a worse result than it needs to be.
 * The providers are not all-or-nothing: when the catalogue that answered has no
 * cover, the others are asked for that one field and nothing else.
 */
async function withBorrowedCover(found: BookResult, isbn13: string, isbn10: string | null): Promise<BookResult> {
  for (const provider of [googleBooks, openLibrary]) {
    if (provider.name === found.source) continue;
    try {
      const other = await provider.lookup(isbn13, isbn10);
      if (other?.coverUrl) return { ...found, coverUrl: other.coverUrl };
    } catch {
      // A missing cover is not worth failing a lookup that already succeeded.
    }
  }
  return found;
}

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
 * A discovery query, passed to Google's `q` verbatim so a caller can use the
 * field qualifiers — `inauthor:"Le Guin"`, `subject:"Science fiction"`.
 *
 * Google only: BN has no relevance ranking and Open Library's search is not
 * worth the latency for a shelf row. A failure here is an empty row, not an
 * error — Browse degrades to the rows that did answer.
 */
export async function browseVolumes(
  query: string,
  { limit = 20, orderBy = 'relevance' }: { limit?: number; orderBy?: BrowseSort } = {},
): Promise<BookResult[]> {
  return googleVolumes(query, limit, orderBy);
}
