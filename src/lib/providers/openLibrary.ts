import { bookKey } from '@/lib/bookKey';

import type { BookResult, IsbnProvider } from './types';

/**
 * Open Library — the fallback, and the only provider for some old printings.
 * Community-contributed and overwhelmingly anglophone, so it catches editions
 * Google has never heard of while missing most of the Polish shelf entirely.
 * Open by definition: no key, no quota.
 */

const OPENLIBRARY_API = 'https://openlibrary.org';

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

async function lookupByIsbn(isbn13: string, isbn10: string | null): Promise<BookResult | null> {
  const response = await fetch(
    `${OPENLIBRARY_API}/api/books?bibkeys=ISBN:${isbn13}&jscmd=data&format=json`,
  );
  if (!response.ok) return null;

  const body = (await response.json()) as Record<string, OpenLibraryEdition>;
  const edition = body[`ISBN:${isbn13}`];
  return edition ? openLibraryToResult(isbn13, isbn10, edition) : null;
}

export const openLibrary: IsbnProvider = {
  name: 'Open Library',
  lookup: (isbn13, isbn10) => lookupByIsbn(isbn13, isbn10),
};
