import { cleanIsbn, parseIsbn } from '@/lib/isbn';

/**
 * The identity of a *book*, independent of whether anyone owns it.
 *
 * Ratings are keyed by this rather than by a book row id, which is what lets
 * you rate something you do not own — a library loan, a friend's copy, a search
 * result — and what makes a rating survive removing the book from your library
 * and adding it back later.
 *
 * Three shapes, and the prefix says which:
 *   isbn:<isbn13>            an edition with an ISBN — the usual case, and what
 *                            a barcode scan always produces
 *   gbooks:<volumeId>        Google Books knows it but it carries no ISBN
 *                            (older books, some self-published editions)
 *   manual:<author>|<title>  a hand-typed entry, keyed by what was typed
 *
 * ISBN wins over the Google volume id deliberately: the same edition has one
 * ISBN but several volume ids across Google's regional catalogues, so keying on
 * the volume would let one physical book be rated twice.
 *
 * Pure and dependency-free so a node script and the tests can use it.
 */

/**
 * Latin letters NFKD will not take apart, because they are single code points
 * rather than a base letter plus a combining mark.
 *
 * Without this the accent-stripping below turns them into separators, so
 * "Stanislaw Lem" spelled with its l-stroke keys as `stanis-aw-lem` — and a
 * copy catalogued with the unaccented spelling, which is what a lot of
 * English-language catalogue data carries, reads as a different author.
 * Polish and the Nordic languages are the ones this actually bites; the rest
 * are here because they cost nothing.
 */
const UNDECOMPOSABLE: Record<string, string> = {
  ł: 'l',
  đ: 'd',
  ð: 'd',
  ø: 'o',
  þ: 'th',
  ß: 'ss',
  æ: 'ae',
  œ: 'oe',
  ı: 'i',
};

/** Lowercase, collapse whitespace, drop punctuation that varies per printing. */
function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[łđðøþßæœı]/g, (char) => UNDECOMPOSABLE[char] ?? char)
    .normalize('NFKD')
    // Strip combining marks so "Kafka" and "Kafka" with an acute key the same.
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, '-');
}

export type BookIdentity = {
  isbn13?: string | null;
  isbn10?: string | null;
  googleId?: string | null;
  title: string;
  authors?: string[] | string | null;
};

export function authorList(authors: string[] | string | null | undefined): string[] {
  if (Array.isArray(authors)) return authors.map((a) => String(a).trim()).filter(Boolean);
  if (typeof authors === 'string') {
    // Legacy rows stored several authors in one string, semicolon-separated. A
    // bare comma is left alone: plenty of names carry one ("King, Jr.").
    const parts = authors.includes(';') ? authors.split(';') : [authors];
    return parts.map((a) => a.trim()).filter(Boolean);
  }
  return [];
}

/**
 * A manual key uses the *first* credited author only. A later edition that adds
 * a translator or an introducer would otherwise read as a different book than
 * the one you already rated.
 */
export function bookKey(identity: BookIdentity): string {
  // An ISBN-10 is normalised up to its 13-digit form first, so typing the
  // number off a copyright page keys the same book as scanning its barcode.
  const parsed = parseIsbn(identity.isbn13 || identity.isbn10);
  if (parsed) return `isbn:${parsed.isbn13}`;

  if (identity.googleId) return `gbooks:${identity.googleId}`;

  const authors = authorList(identity.authors);
  return `manual:${slug(authors[0] ?? 'unknown')}|${slug(identity.title)}`;
}

export function isIsbnKey(key: string): boolean {
  return key.startsWith('isbn:');
}

export function isGoogleKey(key: string): boolean {
  return key.startsWith('gbooks:');
}

/** The ISBN-13 inside a key, or null when the key is not an ISBN one. */
export function isbnFromKey(key: string): string | null {
  return isIsbnKey(key) ? cleanIsbn(key.slice('isbn:'.length)) : null;
}

/** The Google Books volume id inside a key, or null. */
export function googleIdFromKey(key: string): string | null {
  return isGoogleKey(key) ? key.slice('gbooks:'.length) : null;
}
