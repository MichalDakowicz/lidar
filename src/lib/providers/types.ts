/** What every catalogue resolves to, whatever shape it answers in. */
export type BookResult = {
  isbn13: string | null;
  isbn10: string | null;
  googleId: string | null;
  bookKey: string;
  title: string;
  subtitle: string;
  authors: string[];
  coverUrl: string | null;
  publishedDate: string | null;
  pageCount: number | null;
  publisher: string;
  language: string;
  genres: string[];
  description: string;
  url: string;
  /** Which catalogue answered — shown on the scan card so a wrong record is traceable. */
  source?: ProviderName;
};

export type ProviderName = 'Google Books' | 'Open Library' | 'Biblioteka Narodowa';

/**
 * One catalogue's ISBN lookup. Null means "not here", which is a real answer;
 * throwing means the catalogue itself failed, and the chain moves on either way.
 */
export type IsbnProvider = {
  name: ProviderName;
  lookup: (isbn13: string, isbn10: string | null) => Promise<BookResult | null>;
};
