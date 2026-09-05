import type { BookResult } from '@/lib/bookMetadata';
import type { Book } from '@/types/book';

/**
 * A catalogue result dressed as a `Book`, so Browse renders through the same
 * `BookCard` / `BookCarousel` / `BookGrid` the rest of the app uses instead of
 * growing a second set of tiles. The same trick as Radar's `toDiscoveryMovie`.
 *
 * The row fields are blanks, not lies: this book has no row of yours behind it.
 * `id` is the book key, which is unique per edition and is what the lists key
 * on. `status` has to be *something*, so it is `Readlist` — the state a book
 * you have not added is closest to — and every discovery surface passes
 * `showStatus={false}` so that placeholder is never drawn.
 */
export function toDiscoveryBook(result: BookResult): Book {
  return {
    id: result.bookKey,
    userId: '',
    isbn13: result.isbn13,
    isbn10: result.isbn10,
    googleId: result.googleId,
    bookKey: result.bookKey,
    title: result.title,
    subtitle: result.subtitle,
    authors: result.authors,
    coverUrl: result.coverUrl,
    publishedDate: result.publishedDate,
    pageCount: result.pageCount,
    publisher: result.publisher,
    language: result.language,
    series: '',
    seriesIndex: null,
    genres: result.genres,
    description: result.description,
    url: result.url,
    status: 'Readlist',
    notes: '',
    favoriteQuotes: '',
    currentPage: null,
    progressUpdatedAt: null,
    customOrder: null,
    lastReadAt: null,
    addedAt: '',
    updatedAt: '',
  };
}

/**
 * The inverse, for the one thing Browse writes: adding. `useQuickAdd` is the
 * single "put this on my shelf" path in the app and it speaks `BookResult`, so
 * a tile hands back what it was made from rather than Browse growing a write
 * path of its own.
 */
export function fromDiscoveryBook(book: Book): BookResult {
  return {
    isbn13: book.isbn13,
    isbn10: book.isbn10,
    googleId: book.googleId,
    bookKey: book.bookKey,
    title: book.title,
    subtitle: book.subtitle,
    authors: book.authors,
    coverUrl: book.coverUrl,
    publishedDate: book.publishedDate,
    pageCount: book.pageCount,
    publisher: book.publisher,
    language: book.language,
    genres: book.genres,
    description: book.description,
    url: book.url,
  };
}
