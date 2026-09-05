/**
 * ISBN parsing and validation.
 *
 * This is the file the barcode scanner leans on. A book's back cover carries an
 * EAN-13 barcode whose digits *are* the ISBN-13, so the camera hands us a
 * 13-digit string and the only question is whether it is a book at all — which
 * the 978/979 prefix and the check digit answer between them. Without the check
 * a misread barcode (a magazine's EAN, a smudged digit) would send a garbage
 * lookup to Google Books and land an empty row on the shelf.
 *
 * Pure and dependency-free: `lib/` stays free of React so these rules are
 * testable without a renderer.
 */

/** Digits only, uppercased — an ISBN-10 may legitimately end in 'X'. */
export function cleanIsbn(raw: string | null | undefined): string {
  return (raw ?? '').replace(/[^0-9Xx]/g, '').toUpperCase();
}

/**
 * ISBN-10 check digit: sum of digit × (10 − position), mod 11, where a
 * remainder of 10 is written 'X'.
 */
export function isValidIsbn10(raw: string): boolean {
  const isbn = cleanIsbn(raw);
  if (isbn.length !== 10) return false;

  let sum = 0;
  for (let i = 0; i < 9; i += 1) {
    const digit = isbn.charCodeAt(i) - 48;
    if (digit < 0 || digit > 9) return false;
    sum += digit * (10 - i);
  }
  const last = isbn[9];
  const checkValue = last === 'X' ? 10 : last.charCodeAt(0) - 48;
  if (checkValue < 0 || checkValue > 10) return false;

  return (sum + checkValue) % 11 === 0;
}

/**
 * ISBN-13 (== EAN-13) check digit: alternating weights 1 and 3, mod 10.
 * The prefix test is separate on purpose — the arithmetic is what says the scan
 * was read correctly, the prefix is what says it was a book.
 */
export function isValidIsbn13(raw: string): boolean {
  const isbn = cleanIsbn(raw);
  if (isbn.length !== 13 || /\D/.test(isbn)) return false;

  let sum = 0;
  for (let i = 0; i < 12; i += 1) {
    sum += (isbn.charCodeAt(i) - 48) * (i % 2 === 0 ? 1 : 3);
  }
  const check = (10 - (sum % 10)) % 10;

  return check === isbn.charCodeAt(12) - 48;
}

export function isValidIsbn(raw: string): boolean {
  const isbn = cleanIsbn(raw);
  return isbn.length === 13 ? isValidIsbn13(isbn) : isValidIsbn10(isbn);
}

/**
 * Whether a scanned EAN-13 is a book rather than any other retail barcode.
 *
 * 978 is the original Bookland prefix, 979 its overflow (and the home of ISMN
 * sheet music at 979-0, which is why that one sub-range is excluded). Everything
 * else on a 13-digit barcode is groceries — scanning a cereal box should say
 * "that is not a book", not search for one.
 */
export function isBooklandEan(raw: string): boolean {
  const isbn = cleanIsbn(raw);
  if (!isValidIsbn13(isbn)) return false;
  if (isbn.startsWith('978')) return true;
  // 979-0-... is ISMN (printed music), not an ISBN.
  return isbn.startsWith('979') && isbn[3] !== '0';
}

/**
 * ISBN-10 → ISBN-13, so a hand-typed old-format number keys the same book as a
 * scan of the same edition's barcode. The conversion is defined: prepend 978,
 * drop the old check digit, recompute.
 */
export function isbn10To13(raw: string): string | null {
  const isbn = cleanIsbn(raw);
  if (!isValidIsbn10(isbn)) return null;

  const body = `978${isbn.slice(0, 9)}`;
  let sum = 0;
  for (let i = 0; i < 12; i += 1) {
    sum += (body.charCodeAt(i) - 48) * (i % 2 === 0 ? 1 : 3);
  }
  return `${body}${(10 - (sum % 10)) % 10}`;
}

export type ParsedIsbn = { isbn13: string; isbn10: string | null };

/**
 * The one entry point the scanner and the manual field both use: takes anything
 * a human or a camera produced and returns the canonical pair, or null if it is
 * not an ISBN at all.
 *
 * Always normalises to ISBN-13, because that is what `bookKey` is built from —
 * the same physical book must not key two different ways depending on whether
 * it was scanned or typed off the copyright page.
 */
export function parseIsbn(raw: string | null | undefined): ParsedIsbn | null {
  const isbn = cleanIsbn(raw);

  if (isbn.length === 10) {
    const isbn13 = isbn10To13(isbn);
    return isbn13 ? { isbn13, isbn10: isbn } : null;
  }
  if (isbn.length === 13 && isValidIsbn13(isbn)) {
    return { isbn13: isbn, isbn10: isbn13To10(isbn) };
  }
  return null;
}

/** ISBN-13 → ISBN-10, defined only for the 978 range. Null otherwise. */
export function isbn13To10(raw: string): string | null {
  const isbn = cleanIsbn(raw);
  if (!isValidIsbn13(isbn) || !isbn.startsWith('978')) return null;

  const body = isbn.slice(3, 12);
  let sum = 0;
  for (let i = 0; i < 9; i += 1) {
    sum += (body.charCodeAt(i) - 48) * (10 - i);
  }
  const remainder = (11 - (sum % 11)) % 11;
  return `${body}${remainder === 10 ? 'X' : remainder}`;
}

/** Hyphenated for display. Group boundaries vary by registrant, so this only
 * splits the parts that are fixed: prefix, and the check digit. */
export function formatIsbn(raw: string | null | undefined): string {
  const isbn = cleanIsbn(raw);
  if (isbn.length === 13) return `${isbn.slice(0, 3)}-${isbn.slice(3, 12)}-${isbn.slice(12)}`;
  if (isbn.length === 10) return `${isbn.slice(0, 9)}-${isbn.slice(9)}`;
  return isbn;
}
