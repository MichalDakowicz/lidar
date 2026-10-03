import type { Ratings } from '@/types/book';

/**
 * Which questions a rating asks. Radar rates story / acting / ending /
 * enjoyment and Sonar rates production / vocals / lyrics / replay; Lidar's
 * `story` set is the prose equivalent, and they live in the same jsonb column
 * shape so lib/personalScore is shared verbatim across all three apps.
 *
 * `true` is for books about something that happened — a biography, a war
 * memoir, a history — where plot and characters are not things the author made
 * up, so scoring them says nothing. It asks what the book gave you instead.
 *
 * The kind is never stored: it is read back off which facet keys a rating
 * holds (kindOfRatings), so the jsonb stays all numbers and personalScore, the
 * curve and the sort need no idea that two sets exist.
 */
export type RatingKind = 'story' | 'true';

export type FacetKey = 'prose' | 'plot' | 'characters' | 'replay' | 'insight' | 'credibility' | 'impact';

export type FacetDef = { key: FacetKey; label: string; hint: string };

const PROSE: FacetDef = { key: 'prose', label: 'Prose', hint: 'The writing itself, line by line' };

export const FACETS_BY_KIND: Record<RatingKind, FacetDef[]> = {
  story: [
    PROSE,
    { key: 'plot', label: 'Plot', hint: 'Structure, pacing, how it lands' },
    { key: 'characters', label: 'Characters', hint: 'Who is in it and whether they live' },
    { key: 'replay', label: 'Re-read', hint: 'How likely you are to go back' },
  ],
  true: [
    PROSE,
    { key: 'insight', label: 'Insight', hint: 'What it showed or taught you' },
    { key: 'credibility', label: 'Credibility', hint: 'How far you trust it' },
    { key: 'impact', label: 'Impact', hint: 'How much it stayed with you' },
  ],
};

export const RATING_KINDS: { value: RatingKind; label: string; hint: string }[] = [
  { value: 'story', label: 'Story', hint: 'Made up: plot and characters count' },
  { value: 'true', label: 'True account', hint: 'Something that happened: rated on what it gave you' },
];

export const EMPTY_RATINGS: Ratings = {};

/** Every facet of both sets as a number, for a form that needs no undefined branches. */
export type FacetValues = Record<FacetKey, number>;

export const EMPTY_FACETS: FacetValues = {
  prose: 0,
  plot: 0,
  characters: 0,
  replay: 0,
  insight: 0,
  credibility: 0,
  impact: 0,
};

export function toFacetValues(ratings: Ratings | null | undefined): FacetValues {
  return {
    prose: ratings?.prose ?? 0,
    plot: ratings?.plot ?? 0,
    characters: ratings?.characters ?? 0,
    replay: ratings?.replay ?? 0,
    insight: ratings?.insight ?? 0,
    credibility: ratings?.credibility ?? 0,
    impact: ratings?.impact ?? 0,
  };
}

const STORY_ONLY: FacetKey[] = ['plot', 'characters', 'replay'];
const TRUE_ONLY: FacetKey[] = ['insight', 'credibility', 'impact'];

/**
 * The set a saved rating was given in, or null when it cannot tell — a rating
 * that holds only prose and an overall fits both. The caller falls back to the
 * genres then, which is harmless: prose is in both sets, so nothing is lost.
 */
export function kindOfRatings(ratings: Ratings | null | undefined): RatingKind | null {
  if (!ratings) return null;
  if (TRUE_ONLY.some((key) => (ratings[key] ?? 0) > 0)) return 'true';
  if (STORY_ONLY.some((key) => (ratings[key] ?? 0) > 0)) return 'story';
  return null;
}

/**
 * The average of the active set's facets that were filled in, to one decimal —
 * what the "average" button on the overall slider writes. Facets of the other
 * set are ignored even when the draft still holds them. Null when nothing is
 * scored yet, so pressing it on an untouched form cannot stamp a 0.0 rating.
 */
export function recalcOverall(facets: FacetValues, kind: RatingKind): number | null {
  const values = FACETS_BY_KIND[kind].map(({ key }) => facets[key]).filter((v) => v > 0);
  if (values.length === 0) return null;
  return parseFloat((values.reduce((a, b) => a + b, 0) / values.length).toFixed(1));
}

/**
 * Drops the zeroes on the way to the database: an unrated facet should be
 * absent from the jsonb, not stored as 0, or personalScore would have to know
 * the difference between "bad" and "not answered". Only the active set goes —
 * flipping a book to the other kind and saving drops the questions that no
 * longer apply instead of leaving them to be averaged.
 */
export function toRatingsPayload(facets: FacetValues, overall: number, kind: RatingKind): Ratings {
  const payload: Ratings = {};
  for (const { key } of FACETS_BY_KIND[kind]) {
    if (facets[key] > 0) payload[key] = facets[key];
  }
  if (overall > 0) payload.overall = overall;
  return payload;
}

/** True once the payload holds nothing — the signal to delete the rating row. */
export function isEmptyRatings(ratings: Ratings): boolean {
  return Object.values(ratings).every((v) => !v || v <= 0);
}
