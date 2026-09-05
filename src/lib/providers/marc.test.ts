import {
  marcAuthors,
  marcIsbns,
  marcPageCount,
  marcPublisher,
  marcTitle,
  normalizeMarcAuthor,
  parseExtent,
  trimIsbd,
  type MarcEntry,
} from './marc';

/**
 * The real MARC of Chuck Palahniuk, "Fight club: podziemny krąg" (Niebieska
 * Studnia, 2020), recorded from data.bn.org.pl — one of the three ISBNs that
 * sent us looking for a Polish source in the first place.
 */
const FIGHT_CLUB: MarcEntry[] = [
  { '001': 'b000001234567' },
  { '020': { ind1: ' ', ind2: ' ', subfields: [{ a: '9788366324046' }] } },
  { '020': { ind1: ' ', ind2: ' ', subfields: [{ a: '9788366324206' }, { q: '(oprawa miękka)' }] } },
  { '100': { ind1: '1', ind2: ' ', subfields: [{ a: 'Palahniuk, Chuck' }, { d: '(1962- )' }, { e: 'Autor' }] } },
  {
    '245': {
      ind1: '1',
      ind2: '0',
      subfields: [{ a: 'Fight club :' }, { b: 'podziemny krąg /' }, { c: 'Chuck Palahniuk ; przełożył Lech Jęczmyk.' }],
    },
  },
  { '260': { ind1: ' ', ind2: ' ', subfields: [{ a: 'Warszawa :' }, { b: 'Niebieska Studnia,' }, { c: '2020.' }] } },
  { '300': { ind1: ' ', ind2: ' ', subfields: [{ a: '246, [1] strona ;' }, { c: '20 cm.' }] } },
  { '700': { ind1: '1', ind2: ' ', subfields: [{ a: 'Jęczmyk, Lech' }, { d: '(1936-2023)' }, { e: 'Tłumaczenie' }] } },
];

describe('normalizeMarcAuthor', () => {
  it('flips surname-first and drops the catalogue life dates', () => {
    expect(normalizeMarcAuthor('Palahniuk, Chuck (1962- )')).toBe('Chuck Palahniuk');
    expect(normalizeMarcAuthor('Lem, Stanisław (1921-2006)')).toBe('Stanisław Lem');
  });

  it('leaves a corporate author alone — it is not surname-first', () => {
    expect(normalizeMarcAuthor('Wydawnictwo Niebieska Studnia')).toBe('Wydawnictwo Niebieska Studnia');
  });

  it('survives a surname with no given name', () => {
    expect(normalizeMarcAuthor('Homer,')).toBe('Homer');
  });
});

describe('parseExtent', () => {
  it('reads the leading count out of a statement of extent', () => {
    expect(parseExtent('246, [1] strona ;')).toBe(246);
    expect(parseExtent('318, [2] s.')).toBe(318);
    expect(parseExtent('404 stron')).toBe(404);
  });

  it('is null when the extent carries no number', () => {
    expect(parseExtent('1 dysk optyczny (CD-ROM)')).toBe(1);
    expect(parseExtent('nieliczbowane strony')).toBeNull();
  });
});

describe('trimIsbd', () => {
  it('drops the separator MARC leaves for the next subfield', () => {
    expect(trimIsbd('Fight club :')).toBe('Fight club');
    expect(trimIsbd('podziemny krąg /')).toBe('podziemny krąg');
    expect(trimIsbd('Niebieska Studnia,')).toBe('Niebieska Studnia');
  });
});

describe('a real BN record', () => {
  it('takes the title from 245, not from the concatenated convenience field', () => {
    expect(marcTitle(FIGHT_CLUB)).toEqual({ title: 'Fight club', subtitle: 'podziemny krąg' });
  });

  it('credits the author and not the translator', () => {
    expect(marcAuthors(FIGHT_CLUB)).toEqual(['Chuck Palahniuk']);
  });

  it('reads the page count off the statement of extent', () => {
    expect(marcPageCount(FIGHT_CLUB)).toBe(246);
  });

  it('reads the publisher without the trailing comma', () => {
    expect(marcPublisher(FIGHT_CLUB)).toBe('Niebieska Studnia');
  });

  it('collects every ISBN on the record, one per binding', () => {
    expect(marcIsbns(FIGHT_CLUB)).toEqual(['9788366324046', '9788366324206']);
  });
});

describe('a record crediting a second author', () => {
  it('keeps a 700 whose role says author', () => {
    const fields: MarcEntry[] = [
      { '100': { subfields: [{ a: 'Pratchett, Terry' }, { d: '(1948-2015)' }, { e: 'Autor' }] } },
      { '700': { subfields: [{ a: 'Gaiman, Neil' }, { d: '(1960- )' }, { e: 'Autor' }] } },
      { '700': { subfields: [{ a: 'Cholewa, Piotr W.' }, { e: 'Tłumaczenie' }] } },
    ];
    expect(marcAuthors(fields)).toEqual(['Terry Pratchett', 'Neil Gaiman']);
  });
});
