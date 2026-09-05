import { isStarted } from '@/lib/bookStatus';
import { summarizeReads, topRereads, type ReadSummary } from '@/lib/reads';
import type { Book, BookRating, Read } from '@/types/book';

// Every number the Stats screen shows, derived in one pure pass. Ported from
// the legacy Stats.jsx useMemo, which computed all of this inline inside the
// screen; the screen now only lays out what this returns.
//
// "Shelf" everywhere means a book you have actually opened — read, reading or
// put down. A readlist entry is a plan and must not inflate the counts.

export type CountSlice = { name: string; count: number; percent: number };
export type DecadeSlice = { decade: string; count: number };
/** An author ranked by pages rather than by title count — see below. */
export type AuthorSlice = { name: string; pages: number; books: number };

export type LibraryStats = {
  /** Books opened: read + reading + did not finish. Excludes the readlist. */
  totalBooks: number;
  readCount: number;
  readingCount: number;
  readlistCount: number;
  dnfCount: number;
  uniqueAuthors: number;
  topAuthors: CountSlice[];
  /**
   * Authors by pages read, not by books read. A count ranks the writer of six
   * novellas above the writer of one doorstop, which is the opposite of who you
   * have spent your year with.
   */
  authorsByPages: AuthorSlice[];
  topGenres: CountSlice[];
  decades: DecadeSlice[];
  /** Pages finished in the current calendar year, from the read log. */
  pagesThisYear: number;
  /** Pages a day since the first read on record, or null before there is one. */
  averagePagesPerDay: number | null;
  /** The longest book on the shelf, and how long it is. */
  longestBook: { book: Book; pages: number } | null;
  /**
   * Fewest days between starting and finishing. Null until `book_reads.started_at`
   * is actually written — see STATUS "known gaps"; nothing sets it yet, so this
   * reports nothing rather than inventing a duration.
   */
  fastestFinish: { read: Read; days: number } | null;
  /** Read log rollups, already scoped to the chosen period by the caller. */
  reads: ReadSummary;
  /** Books finished more than once. */
  mostReread: { book: Book; count: number }[];
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
  /** Injected so "this year" and "pages a day" are testable against a fixed clock. */
  now?: Date;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** Pages finished per author, over the read log rather than over the shelf. */
function authorPages(books: Book[], reads: Read[]): AuthorSlice[] {
  const byId = new Map(books.map((book) => [book.id, book]));
  const totals = new Map<string, { pages: number; books: number }>();

  for (const read of reads) {
    const pages = read.pageCount ?? byId.get(read.bookId ?? '')?.pageCount ?? 0;
    const authors = read.authors.length > 0 ? read.authors : (byId.get(read.bookId ?? '')?.authors ?? []);
    for (const raw of authors) {
      const name = raw.trim();
      if (!name) continue;
      const entry = totals.get(name) ?? { pages: 0, books: 0 };
      entry.pages += pages;
      entry.books += 1;
      totals.set(name, entry);
    }
  }

  return [...totals]
    .map(([name, entry]) => ({ name, ...entry }))
    .sort((a, b) => b.pages - a.pages || b.books - a.books || a.name.localeCompare(b.name))
    .slice(0, 5);
}

/**
 * The pace numbers. `averagePagesPerDay` is measured from the first read on
 * record rather than over a fixed window, so it answers "how fast do I read"
 * instead of "how much did I read lately" — which is what the period picker and
 * the streak are already for.
 */
function readingPace(reads: Read[], now: Date) {
  const year = now.getFullYear();
  let pagesThisYear = 0;
  let total = 0;
  let earliest = Number.POSITIVE_INFINITY;
  let fastest: { read: Read; days: number } | null = null;

  for (const read of reads) {
    const pages = read.pageCount ?? 0;
    const finished = Date.parse(read.finishedAt);
    if (Number.isNaN(finished)) continue;

    total += pages;
    earliest = Math.min(earliest, finished);
    if (new Date(finished).getFullYear() === year) pagesThisYear += pages;

    const started = read.startedAt ? Date.parse(read.startedAt) : NaN;
    if (!Number.isNaN(started) && finished >= started) {
      // A book started and finished the same day is a one-day read, not a zero.
      const days = Math.max(1, Math.round((finished - started) / DAY_MS));
      if (!fastest || days < fastest.days) fastest = { read, days };
    }
  }

  const span = Number.isFinite(earliest) ? Math.max(1, Math.ceil((now.getTime() - earliest) / DAY_MS)) : 0;

  return {
    pagesThisYear,
    averagePagesPerDay: span > 0 && total > 0 ? Math.round((total / span) * 10) / 10 : null,
    fastestFinish: fastest,
  };
}

function longestOnShelf(books: Book[]): { book: Book; pages: number } | null {
  let best: { book: Book; pages: number } | null = null;
  for (const book of books) {
    const pages = book.pageCount ?? 0;
    if (pages > 0 && (!best || pages > best.pages)) best = { book, pages };
  }
  return best;
}

export function computeStats({ books, reads, ratings, scoreOf, now = new Date() }: StatsInput): LibraryStats {
  const shelf = books.filter(isStarted);
  const total = shelf.length;

  const authors = new Map<string, number>();
  const genres = new Map<string, number>();
  const decades = new Map<number, number>();

  for (const book of shelf) {
    for (const author of book.authors) bump(authors, author);
    for (const genre of book.genres) bump(genres, genre);

    if (book.publishedDate && book.publishedDate.length >= 4) {
      const year = parseInt(book.publishedDate.slice(0, 4), 10);
      if (!Number.isNaN(year)) {
        const decade = Math.floor(year / 10) * 10;
        decades.set(decade, (decades.get(decade) ?? 0) + 1);
      }
    }
  }

  const readSummary = summarizeReads(reads);
  const pageStats = readingPace(reads, now);

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
    readCount: books.filter((book) => book.status === 'Read').length,
    readingCount: books.filter((book) => book.status === 'Reading').length,
    readlistCount: books.filter((book) => book.status === 'Readlist').length,
    dnfCount: books.filter((book) => book.status === 'Did not finish').length,
    uniqueAuthors: authors.size,
    topAuthors: toSlices(authors, total, 5),
    authorsByPages: authorPages(books, reads),
    topGenres: toSlices(genres, total, 5),
    decades: [...decades].sort((a, b) => a[0] - b[0]).map(([decade, count]) => ({ decade: `${decade}s`, count })),
    pagesThisYear: pageStats.pagesThisYear,
    averagePagesPerDay: pageStats.averagePagesPerDay,
    longestBook: longestOnShelf(shelf),
    fastestFinish: pageStats.fastestFinish,
    reads: readSummary,
    mostReread: topRereads(shelf, readSummary, 5),
    ratedCount,
    averageRating: ratedCount === 0 ? null : Math.round((ratingTotal / ratedCount) * 10) / 10,
    bestRated: scoredBooks.sort((a, b) => b.score - a.score || a.book.title.localeCompare(b.book.title)).slice(0, 5),
  };
}
