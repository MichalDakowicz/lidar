/**
 * The MARC bits of a Biblioteka Narodowa bib record.
 *
 * BN's JSON has convenience fields — `title`, `author`, `publisher` — and they
 * are **not usable**. They are space-joined concatenations of every variant on
 * the record: a title comes back as
 *   "Fight club : podziemny krąg / Podziemny krąg Fight club"
 * and an author as
 *   "Palahniuk, Chuck (1962- ) Jęczmyk, Lech (1936-2023) Wydawnictwo Niebieska Studnia"
 * — the novel's translator and its publisher rolled into the author line, with
 * no separator that can be split on. So everything below reads the MARC fields
 * instead, which are properly structured.
 *
 * Pure and separate from the provider so these rules are testable against a
 * recorded response without a network.
 */

export type MarcSubfield = Record<string, string>;
export type MarcField = { ind1?: string; ind2?: string; subfields?: MarcSubfield[] };
/** Each entry is a single-key object: `{ "245": {...} }` or `{ "001": "b0001" }`. */
export type MarcEntry = Record<string, MarcField | string>;

/** Every occurrence of a tag — 020 and 700 legitimately repeat. */
export function marcFields(fields: MarcEntry[] | undefined, tag: string): MarcField[] {
  const out: MarcField[] = [];
  for (const entry of fields ?? []) {
    const value = entry[tag];
    if (value && typeof value === 'object') out.push(value);
  }
  return out;
}

/** All values of one subfield code within a field, in order. */
export function subfields(field: MarcField | undefined, code: string): string[] {
  return (field?.subfields ?? []).map((sub) => sub[code]).filter((value): value is string => typeof value === 'string');
}

export function subfield(field: MarcField | undefined, code: string): string {
  return subfields(field, code)[0] ?? '';
}

/** Trailing ISBD punctuation — MARC ends a subfield with the separator for the next. */
export function trimIsbd(value: string): string {
  return value.replace(/\s*[/:;,=]\s*$/, '').trim();
}

/**
 * "Nazwisko, Imię (1962- )" -> "Imię Nazwisko".
 *
 * The life dates are a disambiguator for a catalogue, not part of a name, and
 * an author rendered "Palahniuk, Chuck (1962- )" on a book card reads as a
 * database leak. Anything without a comma is left alone: a corporate author
 * ("Wydawnictwo Niebieska Studnia") is not surname-first.
 */
export function normalizeMarcAuthor(raw: string): string {
  const withoutDates = raw.replace(/\([^)]*\)/g, '').trim().replace(/[.,]$/, '').trim();
  const comma = withoutDates.indexOf(',');
  if (comma === -1) return withoutDates;
  const surname = withoutDates.slice(0, comma).trim();
  const given = withoutDates.slice(comma + 1).trim();
  return given ? `${given} ${surname}` : surname;
}

/**
 * MARC 300 $a is a statement of extent, not a number: "246, [1] strona ;",
 * "318, [2] s.", "XII, 404 stron". The leading arabic integer is the page
 * count; a roman-numeral preface is deliberately not added to it, because the
 * number on the spine of the book is the arabic one.
 */
export function parseExtent(raw: string): number | null {
  const match = raw.match(/\d+/);
  if (!match) return null;
  const pages = parseInt(match[0], 10);
  return Number.isFinite(pages) && pages > 0 ? pages : null;
}

/**
 * Contributors credited as authors. MARC 100 is the main entry; 700s are added
 * entries and include translators and editors, so they are kept only when $e
 * says they wrote it. Without that filter a Polish translation credits its
 * translator as a co-author of the novel.
 */
const AUTHOR_ROLES = ['autor', 'author'];

export function marcAuthors(fields: MarcEntry[] | undefined): string[] {
  const names: string[] = [];

  for (const field of marcFields(fields, '100')) {
    const name = normalizeMarcAuthor(subfield(field, 'a'));
    if (name) names.push(name);
  }

  for (const field of marcFields(fields, '700')) {
    const roles = subfields(field, 'e').map((role) => role.toLowerCase().replace(/[.,]$/, ''));
    if (!roles.some((role) => AUTHOR_ROLES.includes(role))) continue;
    const name = normalizeMarcAuthor(subfield(field, 'a'));
    if (name && !names.includes(name)) names.push(name);
  }

  return names;
}

/** 245 $a is the title, $b the remainder — "Fight club :" + "podziemny krąg /". */
export function marcTitle(fields: MarcEntry[] | undefined): { title: string; subtitle: string } {
  const field = marcFields(fields, '245')[0];
  return { title: trimIsbd(subfield(field, 'a')), subtitle: trimIsbd(subfield(field, 'b')) };
}

/** 264 is the current tag for publication; 260 is the one older records use. */
export function marcPublisher(fields: MarcEntry[] | undefined): string {
  const field = marcFields(fields, '264')[0] ?? marcFields(fields, '260')[0];
  return trimIsbd(subfield(field, 'b'));
}

export function marcPageCount(fields: MarcEntry[] | undefined): number | null {
  return parseExtent(subfield(marcFields(fields, '300')[0], 'a'));
}

/** Every ISBN on the record — 020 repeats, one per binding. */
export function marcIsbns(fields: MarcEntry[] | undefined): string[] {
  return marcFields(fields, '020')
    .map((field) => subfield(field, 'a').replace(/[^0-9Xx]/g, '').toUpperCase())
    .filter(Boolean);
}
