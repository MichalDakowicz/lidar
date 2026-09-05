import { discoveryRowSpecs, narrowSubject } from './discoveryRows';
import type { Book } from '@/types/book';

function book(overrides: Partial<Book> = {}): Book {
  return {
    id: overrides.id ?? 'a',
    userId: 'u',
    isbn13: null,
    isbn10: null,
    googleId: null,
    subtitle: '',
    publisher: '',
    language: '',
    series: '',
    seriesIndex: null,
    description: '',
    currentPage: null,
    progressUpdatedAt: null,
    bookKey: `manual|${overrides.id ?? 'a'}`,
    title: 'A',
    authors: [],
    coverUrl: null,
    publishedDate: null,
    pageCount: null,
    genres: [],
    url: '',
    status: 'Read',
    notes: '',
    favoriteQuotes: '',
    customOrder: null,
    lastReadAt: null,
    addedAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('narrowSubject', () => {
  it('keeps the most specific segment of a Google category breadcrumb', () => {
    expect(narrowSubject('Fiction / Science Fiction / Space Opera')).toBe('Space Opera');
  });

  it('leaves a plain subject alone', () => {
    expect(narrowSubject('History')).toBe('History');
  });
});

describe('discoveryRowSpecs', () => {
  it('falls back to broad subjects for an empty shelf rather than no rows', () => {
    const rows = discoveryRowSpecs([]);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((row) => row.query.startsWith('subject:'))).toBe(true);
  });

  it('builds an author row from what has been read, most-read first', () => {
    const rows = discoveryRowSpecs([
      book({ id: 'a', authors: ['Ursula K. Le Guin'] }),
      book({ id: 'b', authors: ['Ursula K. Le Guin'] }),
      book({ id: 'c', authors: ['Italo Calvino'] }),
    ]);
    expect(rows[0].title).toBe('More by Ursula K. Le Guin');
    expect(rows[0].query).toBe('inauthor:"Ursula K. Le Guin"');
    expect(rows[1].title).toBe('More by Italo Calvino');
  });

  it('asks for the newest books in a subject, not the most relevant', () => {
    const rows = discoveryRowSpecs([book({ genres: ['Fiction / Science Fiction'] })]);
    const subject = rows.find((row) => row.query.startsWith('subject:'))!;
    expect(subject.query).toBe('subject:"Science Fiction"');
    expect(subject.orderBy).toBe('newest');
  });

  it('does not count a readlist book as something you have read', () => {
    const rows = discoveryRowSpecs([book({ status: 'Readlist', authors: ['Olga Tokarczuk'] })]);
    expect(rows[0].title).toBe('Because Olga Tokarczuk is on your readlist');
  });

  it('gives an author one row, not two, when they are both read and on the readlist', () => {
    const rows = discoveryRowSpecs([
      book({ id: 'a', authors: ['Terry Pratchett'] }),
      book({ id: 'b', status: 'Readlist', authors: ['Terry Pratchett'] }),
    ]);
    expect(rows.filter((row) => row.query.includes('Terry Pratchett'))).toHaveLength(1);
  });

  it('gives every row a distinct id, since it keys both the cache and the list', () => {
    const rows = discoveryRowSpecs([
      book({ id: 'a', authors: ['A'], genres: ['Fiction'] }),
      book({ id: 'b', authors: ['B'], genres: ['History'] }),
      book({ id: 'c', status: 'Readlist', authors: ['C'] }),
    ]);
    expect(new Set(rows.map((row) => row.id)).size).toBe(rows.length);
  });
});
