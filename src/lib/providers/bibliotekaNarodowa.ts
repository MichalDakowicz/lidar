import { bookKey } from '@/lib/bookKey';
import { isbn13To10 } from '@/lib/isbn';

import { marcAuthors, marcIsbns, marcPageCount, marcPublisher, marcTitle, type MarcEntry } from './marc';
import type { BookResult, IsbnProvider } from './types';

/**
 * Biblioteka Narodowa — the Polish national bibliography, free and keyless.
 *
 * Poland has legal deposit, so every book published there reaches the BN. That
 * is the whole reason this provider exists: Google Books indexes Polish
 * publishers thinly and Open Library is overwhelmingly anglophone, so a
 * mid-list Polish novel is in neither.
 *
 * **The parameter is `isbnIssn`, never `isbn`.** This API silently ignores
 * parameters it does not know, and `?isbn=<n>` is one of them — it does not
 * error, it returns the first record in the zone. Verified against a live
 * response: `?isbn=9788308068564` came back with an unrelated 2002 biography.
 * A provider written against `isbn=` would confidently hand the scanner the
 * wrong book, which is worse than finding nothing. `search=` is ignored the
 * same way.
 *
 * ISBNs are stored digits-only, and one record carries every binding's ISBN in
 * a space-separated `isbnIssn`, so the hardback and the paperback resolve to
 * the same bib.
 *
 * **No cover art.** BN's records carry none, so `coverUrl` is always null here
 * and the chain fills it in from another catalogue — see lib/bookMetadata.
 */

const BN_API = 'https://data.bn.org.pl/api/bibs.json';

type BnBib = {
  publicationYear?: string;
  language?: string;
  marc?: { fields?: MarcEntry[] };
};

/** Polish registration group: 978-83-…, the ISBNs this catalogue is for. */
export function isPolishIsbn(isbn13: string): boolean {
  return isbn13.startsWith('97883');
}

function toResult(bib: BnBib, isbn13: string): BookResult | null {
  const fields = bib.marc?.fields;
  const { title, subtitle } = marcTitle(fields);
  // A bib with no title in 245 is a record we cannot render; better to fall
  // through to the next provider than to show "Untitled".
  if (!title) return null;

  const isbns = marcIsbns(fields);
  const matched = isbns.find((value) => value === isbn13) ?? isbn13;

  return {
    isbn13: matched,
    isbn10: isbns.find((value) => value.length === 10) ?? isbn13To10(matched),
    googleId: null,
    bookKey: bookKey({ isbn13: matched, title, authors: marcAuthors(fields) }),
    title,
    subtitle,
    authors: marcAuthors(fields),
    coverUrl: null,
    publishedDate: bib.publicationYear?.trim() || null,
    pageCount: marcPageCount(fields),
    publisher: marcPublisher(fields),
    language: bib.language?.trim() ?? '',
    // BN's `genre` is another space-joined blob ("Thriller Dystopia Powieść")
    // with no separator to split on, so no genres rather than wrong ones.
    genres: [],
    description: '',
    url: '',
    source: 'Biblioteka Narodowa',
  };
}

async function fetchBn(isbn: string): Promise<BookResult | null> {
  const response = await fetch(`${BN_API}?isbnIssn=${encodeURIComponent(isbn)}&limit=1`);
  if (!response.ok) throw new Error(`Biblioteka Narodowa lookup failed (${response.status})`);
  const body = (await response.json()) as { bibs?: BnBib[] };
  const bib = body.bibs?.[0];
  return bib ? toResult(bib, isbn) : null;
}

export const bibliotekaNarodowa: IsbnProvider = {
  name: 'Biblioteka Narodowa',
  lookup: async (isbn13, isbn10) => {
    const found = await fetchBn(isbn13);
    if (found) return found;
    // Older Polish printings are catalogued under their ISBN-10 only.
    return isbn10 ? fetchBn(isbn10) : null;
  },
};
