import { isOwned } from '@/lib/bookStatus';
import { summarizeReads, topSpun, type ReadSummary } from '@/lib/reads';
import type { Book, BookRating, Read } from '@/types/book';

// Every number the Stats screen shows, derived in one pure pass. Ported from
// the legacy Stats.jsx useMemo, which computed all of this inline inside the
// screen; the screen now only lays out what this returns.
//
// "Library" everywhere means status === 'Library': a wishlist entry is a
// plan and must not inflate what you own, what it cost, or the format split.

export type CountSlice = { name: string; count: number; percent: number };
export type DecadeSlice = { decade: string; count: number };

export type LibraryStats = {
  totalBooks: number;
  wishlistCount: number;
  preOrderCount: number;
  uniqueAuthors: number;
  formats: CountSlice[];
  topAuthors: CountSlice[];
  topGenres: CountSlice[];
  topStores: CountSlice[];
  decades: DecadeSlice[];
  totalValue: number;
  averagePrice: number | null;
  mostExpensive: { book: Book; price: number }[];
  /** Read log rollups, already scoped to the chosen period by the caller. */
  reads: ReadSummary;
  mostSpun: { book: Book; count: number }[];
  ratedCount: number;
  averageRating: number | null;
  bestRated: { book: Book; score: number }[];
};

function percentOf(count: number, total: number): number {
  return total > 0 ? Math.round((count / total) * 100) : 0;
}

function toSlices(counts: Map<string, number>, total: number, limit?: number): CountSlice[] {
  const list = [...counts]
    .map(([name, count]) => ({ name, count, percent: percentOf(count, total) }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  return limit ? list.slice(0, limit) : list;
}

function bump(counts: Map<string, number>, key: string) {
  const clean = key.trim();
  if (clean) counts.set(clean, (counts.get(clean) ?? 0) + 1);
}

export type StatsInput = {
  books: Book[];
  reads: Read[];
  ratings: BookRating[];
  /** The score rule, injected so this file stays free of React imports. */
  scoreOf: (ratings: BookRating) => number | null;
};

export function computeStats({ books, reads, ratings, scoreOf }: StatsInput): LibraryStats {
  const library = books.filter(isOwned);
  const total = library.length;

  const formats = new Map<string, number>();
  const authors = new Map<string, number>();
  const genres = new Map<string, number>();
  const stores = new Map<string, number>();
  const decades = new Map<number, number>();
  const priced: { book: Book; price: number }[] = [];
  let totalValue = 0;

  for (const book of library) {
    for (const format of book.formats) bump(formats, format);
    for (const author of book.authors) bump(authors, author);
    for (const genre of book.genres) bump(genres, genre);
    if (book.storeName) bump(stores, book.storeName);

    if (book.publishedDate && book.publishedDate.length >= 4) {
      const year = parseInt(book.publishedDate.slice(0, 4), 10);
      if (!Number.isNaN(year)) {
        const decade = Math.floor(year / 10) * 10;
        decades.set(decade, (decades.get(decade) ?? 0) + 1);
      }
    }

    if (book.pricePaid != null && book.pricePaid > 0) {
      totalValue += book.pricePaid;
      priced.push({ book, price: book.pricePaid });
    }
  }

  const readSummary = summarizeReads(reads);

  // Ratings are keyed by release, not by book row, so a rating for something
  // no longer on the shelf still counts towards how you rate — but "best rated"
  // can only link to books that exist, so that list joins back through the key.
  const byKey = new Map(books.map((book) => [book.bookKey, book]));
  let ratingTotal = 0;
  let ratedCount = 0;
  const scoredBooks: { book: Book; score: number }[] = [];

  for (const rating of ratings) {
    const score = scoreOf(rating);
    if (score == null || score <= 0) continue;
    ratingTotal += score;
    ratedCount += 1;
    const book = byKey.get(rating.bookKey);
    if (book) scoredBooks.push({ book, score });
  }

  return {
    totalBooks: total,
    wishlistCount: books.filter((book) => book.status === 'Wishlist').length,
    preOrderCount: books.filter((book) => book.status === 'Pre-order').length,
    uniqueAuthors: authors.size,
    formats: toSlices(formats, total),
    topAuthors: toSlices(authors, total, 5),
    topGenres: toSlices(genres, total, 5),
    topStores: toSlices(stores, total, 5),
    decades: [...decades].sort((a, b) => a[0] - b[0]).map(([decade, count]) => ({ decade: `${decade}s`, count })),
    totalValue: Math.round(totalValue * 100) / 100,
    averagePrice: priced.length === 0 ? null : Math.round((totalValue / priced.length) * 100) / 100,
    mostExpensive: priced.sort((a, b) => b.price - a.price).slice(0, 5),
    reads: readSummary,
    mostSpun: topSpun(library, readSummary, 5),
    ratedCount,
    averageRating: ratedCount === 0 ? null : Math.round((ratingTotal / ratedCount) * 10) / 10,
    bestRated: scoredBooks.sort((a, b) => b.score - a.score || a.book.title.localeCompare(b.book.title)).slice(0, 5),
  };
}
