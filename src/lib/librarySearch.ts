import { cleanIsbn } from '@/lib/isbn';
import type { Book } from '@/types/book';

type SearchableBook = Pick<
  Book,
  'title' | 'subtitle' | 'authors' | 'genres' | 'publishedDate' | 'publisher' | 'series' | 'isbn13' | 'isbn10'
>;

/**
 * What the library search box matches: title and subtitle, author, genre,
 * publisher, series, publication year — and the ISBN, which
 * matters more here than the equivalent did in the sibling apps. Scanning a
 * book you already own should find its row, and the scanner types the number
 * straight into this box.
 *
 * The ISBN comparison runs on cleaned digits so a hyphenated number off a
 * copyright page matches a scanned one.
 */
export function bookMatchesSearchQuery(book: SearchableBook, query: string): boolean {
  const trimmed = query.trim();
  if (!trimmed) return true;

  const lower = trimmed.toLowerCase();
  const titleMatch = book.title?.toLowerCase().includes(lower) ?? false;
  const subtitleMatch = !!book.subtitle && book.subtitle.toLowerCase().includes(lower);
  const authorMatch = book.authors.join(' ').toLowerCase().includes(lower);
  const genreMatch = book.genres.some((genre) => genre.toLowerCase().includes(lower));
  const publisherMatch = !!book.publisher && book.publisher.toLowerCase().includes(lower);
  const seriesMatch = !!book.series && book.series.toLowerCase().includes(lower);
  const yearMatch = !!book.publishedDate && book.publishedDate.startsWith(trimmed);

  const digits = cleanIsbn(trimmed);
  const isbnMatch = digits.length >= 6 && (book.isbn13?.includes(digits) || book.isbn10?.includes(digits) || false);

  return (
    titleMatch ||
    subtitleMatch ||
    authorMatch ||
    genreMatch ||
    publisherMatch ||
    seriesMatch ||
    yearMatch ||
    isbnMatch
  );
}
