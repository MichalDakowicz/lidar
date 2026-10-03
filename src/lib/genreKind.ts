import type { RatingKind } from './ratings';

// Matched against the genres joined into one lowercase string. Catalogue genres
// arrive in English (Google Books categories, Open Library subjects) and
// sometimes Polish, so both are listed; plain substrings, because the headings
// are free text ("Biography & Autobiography", "World War, 1939-1945").
const NONFICTION = /non[- ]?fiction/;
const FICTION = /fiction|novel|fantas|thriller|romance|powie[sś][cć]|fantastyk/;
const TRUE_ACCOUNT =
  /biograph|autobiograph|memoir|\bhistor(?:y|ia)\b|\bwars?\b|military|holocaust|true crime|personal narrative|diar(?:y|ies)|reportage|journalism|pami[eę]tnik|wspomnienia|biografi|reporta[zż]|wojn|wojen|wojsk/;

/**
 * Which facet set a book probably wants, from its catalogue genres. A starting
 * point for the editor's Story / True account switch, never a verdict: catalogues
 * are patchy (Biblioteka Narodowa and manual entries carry no genres at all), so
 * no genres means Story and the reader flips it.
 *
 * Fiction wins over a true-account word because the headings overlap on purpose —
 * "Historical fiction", "Fiction / War & Military", "Biographical fiction" are
 * all made up, and rating their plot is exactly right.
 */
export function guessKindFromGenres(genres: string[] | null | undefined): RatingKind {
  const text = (genres ?? []).join(' | ').toLowerCase();
  if (!text) return 'story';
  if (FICTION.test(text.replace(new RegExp(NONFICTION, 'g'), ' '))) return 'story';
  return NONFICTION.test(text) || TRUE_ACCOUNT.test(text) ? 'true' : 'story';
}
