import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { fetchVolume, lookupIsbn, searchBooks, type BookResult } from '@/lib/googleBooks';
import { parseIsbn } from '@/lib/isbn';

/** Debounce a fast-changing string, so a keystroke is not a network call. */
export function useDebounced<T>(value: T, delay = 400): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

/**
 * Google Books search, cached per term.
 *
 * An ISBN typed or pasted into the box resolves straight to that one edition
 * instead of being searched as text — the same path a barcode scan takes, so
 * reading the number off a copyright page and scanning the barcode land on
 * exactly the same result.
 *
 * There is no `unconfigured` branch here as there is in Sonar's Spotify search:
 * Google Books and Open Library both answer anonymous requests, so this works
 * on a fresh clone with an empty `.env`.
 */
export function useBookSearch(term: string) {
  const query = useDebounced(term.trim());

  const result = useQuery({
    queryKey: ['bookSearch', query],
    queryFn: async (): Promise<BookResult[]> => {
      const isbn = parseIsbn(query);
      if (isbn) {
        const found = await lookupIsbn(isbn.isbn13);
        return found ? [found] : [];
      }
      return searchBooks(query);
    },
    enabled: query.length > 1,
    staleTime: 5 * 60 * 1000,
  });

  return {
    results: result.data ?? [],
    loading: result.isFetching,
    error: result.error,
  };
}

/** Full metadata for one book — the description only comes from the volume endpoint. */
export function useBookResult(googleId: string | null | undefined) {
  const query = useQuery({
    queryKey: ['bookVolume', googleId],
    queryFn: () => fetchVolume(googleId!),
    enabled: !!googleId,
    staleTime: 24 * 60 * 60 * 1000,
  });
  return { book: query.data ?? null, loading: query.isLoading, error: query.error };
}

/**
 * One ISBN to one book, for the scanner. Kept beside the search hook rather
 * than inside the scanner component so a scan result is cached the same way a
 * search result is — re-scanning the same spine does not hit the network twice.
 */
export function useIsbnLookup(isbn: string | null) {
  const query = useQuery({
    queryKey: ['isbnLookup', isbn],
    queryFn: () => lookupIsbn(isbn!),
    enabled: !!isbn,
    staleTime: 24 * 60 * 60 * 1000,
    retry: 1,
  });
  return {
    book: query.data ?? null,
    loading: query.isFetching,
    /** Resolved, and the catalogues have never heard of it. */
    notFound: query.isFetched && !query.isFetching && query.data === null,
    error: query.error,
  };
}
