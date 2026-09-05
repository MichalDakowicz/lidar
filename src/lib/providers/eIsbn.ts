import { bookKey } from '@/lib/bookKey';
import { isbn13To10 } from '@/lib/isbn';

import { parseOnixProduct } from './onix';
import type { BookResult, IsbnProvider } from './types';

/**
 * e-ISBN — the Polish ISBN Agency's register, run by the Biblioteka Narodowa.
 *
 * This is the register a Polish publisher files with *when it assigns the
 * ISBN*, so it holds books that are brand new, self-published, or otherwise not
 * yet in the national bibliography — precisely the tail BN still misses. The
 * two are complementary rather than redundant: of the three Polish ISBNs that
 * sent us looking, BN answered one and e-ISBN answered a different one.
 *
 * It is a real, documented API — ONIX 3.0, registered on Poland's open-data
 * portal (dane.gov.pl dataset 3178) — not a scrape of the search page. The
 * search page has no JSON behind it, which is why the plan said to stop and ask
 * before touching it; this is the thing the plan did not know existed.
 *
 * **The parameter is `isbn`, and only `isbn`.** `isbn13`, `productIdentifier`
 * and `search` are all silently ignored and return the first page of the bulk
 * export instead — the same trap BN's API sets with the opposite spelling.
 * Verified against live responses. The ISBN on the returned product is checked
 * against the one asked for, so an ignored parameter can never be mistaken for
 * a hit.
 *
 * Queried with the plain ISBN-13: the hyphenated form also works, the ISBN-10
 * does not. No cover art — see lib/bookMetadata, which borrows one.
 *
 * **UNVERIFIED ON DEVICE: the TLS chain is incomplete.** e-isbn.pl serves only
 * its leaf certificate and omits the Certum intermediate that signs it. Desktop
 * browsers and curl paper over that from a cached or OS-supplied intermediate;
 * Node rejects it outright (`UNABLE_TO_VERIFY_LEAF_SIGNATURE`), and Android's
 * default TrustManager does not chase the AIA extension either, so this may
 * fail on a phone while working on the web build. It is written to fail safe —
 * a throw here is caught by the chain in lib/bookMetadata and the next provider
 * runs — so the cost is a silent no-op rather than a broken scan. Confirm with
 * a real scan of 978-83-8196-545-3 before trusting the hit rate on Android.
 */

const EISBN_API = 'https://e-isbn.pl/IsbnWeb/api.xml';

async function fetchEisbn(isbn13: string): Promise<BookResult | null> {
  const response = await fetch(`${EISBN_API}?isbn=${encodeURIComponent(isbn13)}`);
  if (!response.ok) throw new Error(`e-ISBN lookup failed (${response.status})`);

  const parsed = parseOnixProduct(await response.text());
  if (!parsed) return null;
  // The guard against a silently-ignored parameter: a record whose ISBN is not
  // the one we asked for is the first row of the bulk export, not our book.
  if (parsed.isbn13 && parsed.isbn13 !== isbn13) return null;

  return {
    isbn13,
    isbn10: parsed.isbn10 ?? isbn13To10(isbn13),
    googleId: null,
    bookKey: bookKey({ isbn13, title: parsed.title, authors: parsed.authors }),
    title: parsed.title,
    subtitle: parsed.subtitle,
    authors: parsed.authors,
    coverUrl: null,
    publishedDate: parsed.publishedDate,
    pageCount: parsed.pageCount,
    publisher: parsed.publisher,
    language: parsed.language,
    genres: [],
    description: '',
    url: '',
    source: 'e-ISBN',
  };
}

export const eIsbn: IsbnProvider = {
  name: 'e-ISBN',
  lookup: (isbn13) => fetchEisbn(isbn13),
};
