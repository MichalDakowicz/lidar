import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

import { useAuth } from '@/features/auth/AuthProvider';
import { useBooks } from '@/hooks/useBooks';

import { browseRowOptions } from './browseQueries';
import { discoveryRowSpecs } from './discoveryRows';

/**
 * Warms Browse's rows in the background right after login, so the tab opens on
 * content rather than on a row of spinners. Mounted once in the tabs layout,
 * the same way Radar's does it.
 *
 * Waits for the library first: the rows are derived from what you have read, so
 * preloading against an empty shelf would cache the three fallback subject rows
 * and hand them to a reader who has a shelf. Runs once — the ref guards against
 * a realtime library update re-triggering the fan-out.
 */
export function useBrowsePreload() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { books, loading } = useBooks();
  const done = useRef(false);

  useEffect(() => {
    // Without a user the library query is disabled (loading false, books empty),
    // so gate on the user too or this caches a feed for nobody.
    if (done.current || !user || loading) return;
    done.current = true;
    void Promise.all(discoveryRowSpecs(books).map((spec) => queryClient.prefetchQuery(browseRowOptions(spec))));
  }, [user, loading, books, queryClient]);
}
