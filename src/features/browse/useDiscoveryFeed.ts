import { useQueries } from '@tanstack/react-query';
import { useMemo } from 'react';

import type { Book } from '@/types/book';

import { browseRowOptions } from './browseQueries';
import { discoveryRowSpecs } from './discoveryRows';

export type DiscoveryRowData = { id: string; title: string; books: Book[] };

/**
 * Browse's rows. One query per row rather than one query for the feed, so a row
 * paints the moment its own call lands and a row Google refuses does not take
 * the others down with it.
 *
 * Books already on the shelf are dropped from every row. The rows are built
 * from what you have read, so without this "More by Ursula K. Le Guin" opens
 * with the two of hers you already have — which is the opposite of *more*.
 */
export function useDiscoveryFeed(shelf: Book[]) {
  const specs = useMemo(() => discoveryRowSpecs(shelf), [shelf]);
  const shelfKeys = useMemo(() => new Set(shelf.map((book) => book.bookKey)), [shelf]);

  const results = useQueries({ queries: specs.map(browseRowOptions) });

  // Not memoized: `useQueries` hands back a fresh wrapper array every render, so
  // a memo here would need a spread dependency list. The work is a filter over a
  // handful of rows, and the `Book` objects inside come from the queries' cached
  // `select`, so the identities BookCard memoizes on are stable regardless.
  const rows: DiscoveryRowData[] = [];
  specs.forEach((spec, index) => {
    const books = (results[index]?.data ?? []).filter((book) => !shelfKeys.has(book.bookKey));
    if (books.length > 0) rows.push({ id: spec.id, title: spec.title, books });
  });

  return {
    rows,
    loading: results.some((result) => result.isLoading),
    /** Every row failed — the only case worth an error screen. */
    failed: results.length > 0 && results.every((result) => result.isError),
    refetch: () => results.forEach((result) => void result.refetch()),
  };
}
