import { isReadlist, isStarted } from '@/lib/bookStatus';
import type { BrowseSort } from '@/lib/bookMetadata';
import type { Book } from '@/types/book';

/**
 * What Browse's rows are, derived from the shelf. Pure, so the rules are
 * testable without a renderer or a network — the fetching lives in
 * useDiscoveryFeed.
 *
 * **Why these rows and not a trending feed.** Radar's Browse is fed by TMDB's
 * curated `trending` / `popular` / `upcoming` endpoints. Google Books has no
 * equivalent: there is no chart to ask for, and there is no honest way to
 * fake one. So every row here is a query Google can actually answer, built out
 * of what this reader has actually read. A shelf of one author produces a row
 * about that author; an empty shelf falls back to the broadest subjects there
 * are, which is the only thing left to say to someone with no history.
 */
export type RowSpec = {
  /** Stable across renders — it is the react-query key and the React key. */
  id: string;
  title: string;
  /** Google's `q`, qualifiers and all. */
  query: string;
  orderBy: BrowseSort;
};

const MAX_AUTHOR_ROWS = 3;
const MAX_SUBJECT_ROWS = 2;
const MAX_READLIST_ROWS = 2;

/**
 * Google returns categories as breadcrumbs — "Fiction / Science Fiction /
 * Space Opera". The last segment is the specific one, and the specific one is
 * what makes a row worth reading: "New in Fiction" says nothing.
 */
export function narrowSubject(genre: string): string {
  const parts = genre.split('/').map((part) => part.trim()).filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1] : '';
}

function rank(values: Iterable<string>): string[] {
  const counts = new Map<string, number>();
  for (const value of values) {
    const clean = value.trim();
    if (clean) counts.set(clean, (counts.get(clean) ?? 0) + 1);
  }
  // Count first, then alphabetical, so the row order does not shuffle between
  // renders on a shelf where everything is tied at one.
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([value]) => value);
}

function authorsOf(books: Book[], keep: (book: Book) => boolean): string[] {
  return rank(books.filter(keep).flatMap((book) => book.authors));
}

/** Quoted, so a multi-word name is one term rather than three loose ones. */
function authorQuery(author: string): string {
  return `inauthor:"${author.replace(/"/g, '')}"`;
}

function subjectQuery(subject: string): string {
  return `subject:"${subject.replace(/"/g, '')}"`;
}

/**
 * Nothing read, nothing planned — so there is no signal to personalise on.
 * These are deliberately broad: the point is that Browse opens with something
 * on it rather than an empty screen the first time it is ever tapped.
 */
const FALLBACK_SUBJECTS = ['Fiction', 'Biography & Autobiography', 'History'];

export function discoveryRowSpecs(books: Book[]): RowSpec[] {
  const readAuthors = authorsOf(books, isStarted);
  const readlistAuthors = authorsOf(books, isReadlist);
  const subjects = rank(books.filter(isStarted).flatMap((book) => book.genres.map(narrowSubject)));

  const rows: RowSpec[] = [];

  for (const author of readAuthors.slice(0, MAX_AUTHOR_ROWS)) {
    rows.push({ id: `author:${author}`, title: `More by ${author}`, query: authorQuery(author), orderBy: 'relevance' });
  }

  for (const subject of subjects.slice(0, MAX_SUBJECT_ROWS)) {
    rows.push({ id: `subject:${subject}`, title: `New in ${subject}`, query: subjectQuery(subject), orderBy: 'newest' });
  }

  // An author is only worth a second row if they are not already above: the
  // same shelf often has one of theirs read and another waiting.
  const covered = new Set(readAuthors.slice(0, MAX_AUTHOR_ROWS));
  for (const author of readlistAuthors.filter((author) => !covered.has(author)).slice(0, MAX_READLIST_ROWS)) {
    rows.push({
      id: `readlist:${author}`,
      title: `Because ${author} is on your readlist`,
      query: authorQuery(author),
      orderBy: 'relevance',
    });
  }

  if (rows.length > 0) return rows;

  return FALLBACK_SUBJECTS.map((subject) => ({
    id: `subject:${subject}`,
    title: `New in ${subject}`,
    query: subjectQuery(subject),
    orderBy: 'newest' as const,
  }));
}
