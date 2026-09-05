import { buildExportPayload, isDuplicate, parseImport } from './dataTransfer';
import type { Book, BookRating, Read } from '@/types/book';

function book(overrides: Partial<Book> = {}): Book {
  return {
    id: 'row-1',
    userId: 'u',
    isbn13: '9780571228225',
    isbn10: '0571228224',
    googleId: null,
    bookKey: 'isbn:9780571228225',
    title: 'The Road',
    subtitle: '',
    authors: ['Cormac McCarthy'],
    coverUrl: null,
    publishedDate: '2006-09-26',
    pageCount: 241,
    publisher: 'Picador',
    language: 'en',
    series: '',
    seriesIndex: null,
    genres: [],
    description: '',
    url: '',
    status: 'Read',
    notes: '',
    favoriteQuotes: '',
    currentPage: null,
    progressUpdatedAt: null,
    customOrder: null,
    lastReadAt: null,
    addedAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('buildExportPayload', () => {
  it('drops the identity fields that are re-minted on import', () => {
    const payload = buildExportPayload([book()], [], [], '2026-06-01T00:00:00.000Z');
    expect(payload.books[0]).not.toHaveProperty('id');
    expect(payload.books[0]).not.toHaveProperty('userId');
    expect(payload.counts).toEqual({ books: 1, ratings: 0, reads: 0 });
  });

  it('carries ratings and reads, not just the library', () => {
    const rating: BookRating = {
      userId: 'u',
      bookKey: 'k',
      isbn13: null,
      title: 'T',
      authors: [],
      coverUrl: null,
      publishedDate: null,
      ratings: { overall: 4 },
      review: 'good',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    const read: Read = {
      id: 's',
      userId: 'u',
      bookId: 'row-1',
      bookKey: 'k',
      title: 'T',
      authors: [],
      coverUrl: null,
      startedAt: null,
      finishedAt: '2026-05-01T00:00:00.000Z',
      pageCount: null,
    };
    const payload = buildExportPayload([], [rating], [read], '2026-06-01T00:00:00.000Z');
    expect(payload.ratings[0].review).toBe('good');
    expect(payload.reads[0]).not.toHaveProperty('bookId');
  });
});

describe('parseImport', () => {
  it('rejects nonsense with a readable error rather than throwing', () => {
    expect(parseImport('not json').errors[0]).toMatch(/Invalid JSON/);
    expect(parseImport('   ').errors[0]).toMatch(/Nothing to import/);
    expect(parseImport('{"foo":1}').errors[0]).toMatch(/Unrecognised/);
  });

  it('reads a Lidar export back', () => {
    const json = JSON.stringify(buildExportPayload([book()], [], [], '2026-06-01T00:00:00.000Z'));
    const parsed = parseImport(json);
    expect(parsed.books).toHaveLength(1);
    expect(parsed.books[0].bookKey).toBe('isbn:9780571228225');
  });

  it('reads a bare array of books', () => {
    const parsed = parseImport(JSON.stringify([{ title: 'The Trial', authors: ['Franz Kafka'] }]));
    expect(parsed.books[0].bookKey).toBe('manual:franz-kafka|the-trial');
  });

  it('reads a legacy export: keyed objects, retired fields, epoch millis', () => {
    const legacy = {
      books: {
        '-Nabc': {
          title: 'Dune',
          authors: 'Frank Herbert',
          format: 'Hardcover',
          addedAt: 1700000000000,
          lastListened: 1700086400000,
          rating: 4.5,
        },
      },
      history: {
        '-Nxyz': { bookId: '-Nabc', title: 'Dune', authors: 'Frank Herbert', timestamp: 1700086400000 },
      },
    };
    const parsed = parseImport(JSON.stringify(legacy));

    expect(parsed.books).toHaveLength(1);
    // `format` is an ownership field and 0.2.0 does not carry it any more.
    expect(parsed.books[0]).not.toHaveProperty('formats');
    expect(parsed.books[0].authors).toEqual(['Frank Herbert']);
    // A row with a read behind it is a book that was read, not one still to go.
    expect(parsed.books[0].status).toBe('Read');
    expect(parsed.books[0].addedAt).toBe(new Date(1700000000000).toISOString());
    expect(parsed.books[0].lastReadAt).toBe(new Date(1700086400000).toISOString());
    // The legacy single `rating` becomes an overall score on a rating row.
    expect(parsed.ratings[0].ratings).toEqual({ overall: 4.5 });
    expect(parsed.reads).toHaveLength(1);
  });

  it('skips a book with no title, and says so', () => {
    const parsed = parseImport(JSON.stringify([{ authors: ['Nobody'] }]));
    expect(parsed.books).toHaveLength(0);
    expect(parsed.errors[0]).toMatch(/missing title/);
  });

  it('lets an explicit rating row win over one rebuilt from a book row', () => {
    const parsed = parseImport(
      JSON.stringify({
        books: [{ title: 'The Trial', authors: ['Franz Kafka'], rating: 3 }],
        ratings: [{ bookKey: 'manual:franz-kafka|the-trial', title: 'The Trial', ratings: { overall: 5 } }],
      }),
    );
    expect(parsed.ratings).toHaveLength(1);
    expect(parsed.ratings[0].ratings.overall).toBe(5);
  });
});

describe('isDuplicate', () => {
  it('matches on book key, so re-importing a backup adds nothing', () => {
    const existing = [book()];
    expect(isDuplicate({ title: 'The Road', bookKey: 'isbn:9780571228225' }, existing)).toBe(true);
    expect(isDuplicate({ title: 'Blood Meridian', bookKey: 'isbn:9780330510943' }, existing)).toBe(false);
  });

  it('falls back to a case-insensitive title when a key is missing', () => {
    expect(isDuplicate({ title: 'the road' }, [book()])).toBe(true);
  });
});
