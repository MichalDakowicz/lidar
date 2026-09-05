/**
 * "Nazwisko, Imię (1913-1960)" -> "Imię Nazwisko".
 *
 * Both Polish catalogues invert personal names — MARC 100 $a and ONIX
 * `PersonNameInverted` — and both hang a life-date disambiguator off them. The
 * dates are a catalogue's way of telling two Camuses apart; on a book card they
 * read as a database leak.
 *
 * Anything without a comma is left alone: a corporate author ("Państwowy
 * Instytut Wydawniczy") is not surname-first, and flipping it would be worse
 * than doing nothing.
 */
export function normalizeInvertedName(raw: string): string {
  const withoutDates = raw.replace(/\([^)]*\)/g, '').trim().replace(/[.,]$/, '').trim();
  const comma = withoutDates.indexOf(',');
  if (comma === -1) return withoutDates;
  const surname = withoutDates.slice(0, comma).trim();
  const given = withoutDates.slice(comma + 1).trim();
  return given ? `${given} ${surname}` : surname;
}
