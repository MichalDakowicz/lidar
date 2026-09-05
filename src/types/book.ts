// App-side shapes, produced at the read boundary (lib/normalizeBook). Screens
// consume these, never a raw Postgres row.

/** A copy you own of a book. Physical or not — "Ebook" is a format too. */
export type Format = 'Hardcover' | 'Paperback' | 'Ebook' | 'Audiobook';

/** Where a book sits on your shelf. Mutually exclusive, unlike Format. */
export type BookStatus = 'Library' | 'Reading' | 'Wishlist' | 'Pre-order' | 'Did not finish';

/**
 * The four facets plus the overall score, in the same jsonb shape Radar stores
 * film ratings in and Sonar stores album ratings in — so lib/personalScore is
 * one function shared by all three apps. Every value is 0–5 in half steps
 * (overall in 0.1 steps); 0 means unrated.
 */
export type Ratings = {
  prose?: number;
  plot?: number;
  characters?: number;
  replay?: number;
  overall?: number;
};

/**
 * A rating, which exists independently of owning anything (public.book_ratings
 * has no FK to public.books). `bookKey` identifies the edition: 'isbn:<isbn13>'
 * when known, else 'gbooks:<volumeId>', else 'manual:<author>|<title>'
 * (lib/bookKey).
 */
export type BookRating = {
  userId: string;
  bookKey: string;
  isbn13: string | null;
  title: string;
  authors: string[];
  coverUrl: string | null;
  publishedDate: string | null;
  ratings: Ratings;
  review: string;
  createdAt: string;
  updatedAt: string;
};

export type Book = {
  id: string;
  userId: string;
  isbn13: string | null;
  isbn10: string | null;
  googleId: string | null;
  bookKey: string;
  title: string;
  subtitle: string;
  authors: string[];
  coverUrl: string | null;
  /** Year, year-month or full date — Google Books' precision varies by edition. */
  publishedDate: string | null;
  pageCount: number | null;
  publisher: string;
  language: string;
  series: string;
  seriesIndex: number | null;
  genres: string[];
  description: string;
  url: string;
  formats: Format[];
  status: BookStatus;

  // edition / personal details
  notes: string;
  favoriteQuotes: string;
  acquisitionDate: string | null;
  storeName: string;
  pricePaid: number | null;
  edition: string;

  /** Live bookmark. The read log is the history; this is where you are now. */
  currentPage: number | null;
  progressUpdatedAt: string | null;

  customOrder: number | null;
  /** Mirror of the newest finished read (lib/reads is the source of truth). */
  lastReadAt: string | null;
  addedAt: string;
  updatedAt: string;
};

/** One finished read. Re-reads are separate rows. */
export type Read = {
  id: string;
  userId: string;
  bookId: string | null;
  bookKey: string | null;
  title: string;
  authors: string[];
  coverUrl: string | null;
  startedAt: string | null;
  finishedAt: string;
  pageCount: number | null;
};

export type BookActivityType =
  | 'added'
  | 'finished_read'
  | 'progress_updated'
  | 'status_changed'
  | 'rating_changed'
  | 'format_added'
  | 'updated'
  | 'removed';

export type BookActivityEvent = {
  id: string;
  userId: string;
  bookId: string | null;
  bookKey: string | null;
  bookTitle: string;
  type: BookActivityType;
  details: Record<string, unknown>;
  createdAt: string;
};

/**
 * The shared identity row (public.profiles), read here without Radar's
 * `favorites` column on purpose: that column holds Radar's pinned top 4 and is
 * capped at four entries, so writing book picks into it would silently
 * overwrite the films the same person pinned in the other app. Lidar's shelf
 * leads with its top-rated books instead, which it can derive.
 */
export type Profile = {
  id: string;
  username: string;
  displayName: string | null;
  pfp: string | null;
  createdAt: string;
};
