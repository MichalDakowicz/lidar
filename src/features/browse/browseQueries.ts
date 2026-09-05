import { queryOptions } from '@tanstack/react-query';

import { browseVolumes, type BookResult } from '@/lib/googleBooks';

import { toDiscoveryBook } from './toDiscoveryBook';
import type { RowSpec } from './discoveryRows';

const HOUR = 60 * 60 * 1000;

// Module scope, so the reference is stable across calls: react-query memoizes a
// `select` result on (data, select fn), and a fresh arrow per render would
// re-map every row on every render and hand BookCard new objects each time,
// defeating its memo.
const toDiscoveryBooks = (results: BookResult[]) => results.map(toDiscoveryBook);

/**
 * One discovery row's fetch, as shared options so the screen and the preloader
 * cannot disagree about the key — a preload written against a different key is
 * a preload that warms nothing.
 *
 * Cached hard on purpose: these rows answer "what else has this author
 * written", which does not change hour to hour, and every row is a separate
 * Google call. A cheap staleTime here would mean a fan-out of requests on every
 * visit to the tab.
 */
export function browseRowOptions(spec: RowSpec) {
  return queryOptions({
    queryKey: ['browse-row', spec.query, spec.orderBy] as const,
    queryFn: () => browseVolumes(spec.query, { limit: 20, orderBy: spec.orderBy }),
    select: toDiscoveryBooks,
    staleTime: 12 * HOUR,
    gcTime: 24 * HOUR,
    // A row that fails is an empty row, not an error screen: the other rows are
    // still worth showing, and Google rate-limits per IP.
    retry: 1,
  });
}
