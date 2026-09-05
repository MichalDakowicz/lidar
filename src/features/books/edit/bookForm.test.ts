import { buildBookPayload, fromBook, isDirty, validate } from './bookForm';
import type { Book } from '@/types/book';

function book(overrides: Partial<Book> = {}): Book {
  return {
    id: 'row-1',
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
    bookKey: 'manual:ursula-k-le-guin|the-dispossessed',
    title: 'The Dispossessed',
    authors: ['Ursula K. Le Guin'],
    coverUrl: null,
    publishedDate: '1974-05-01',
    pageCount: 341,
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

describe('validate', () => {
  it('accepts an untouched form off a real row', () => {
    expect(validate(fromBook(book()))).toEqual({});
  });

  it('demands a title', () => {
    expect(validate({ ...fromBook(book()), title: '  ' }).title).toBeDefined();
  });
});

describe('buildBookPayload', () => {
  it('sends null rather than an empty string for the nullable columns', () => {
    const payload = buildBookPayload({ ...fromBook(book()), coverUrl: '', publishedDate: '' });
    expect(payload.coverUrl).toBeNull();
    expect(payload.publishedDate).toBeNull();
  });

  it('trims what the user typed', () => {
    const payload = buildBookPayload({ ...fromBook(book()), title: '  The Left Hand of Darkness  ' });
    expect(payload.title).toBe('The Left Hand of Darkness');
  });

  it('carries the status through even when it did not change', () => {
    expect(buildBookPayload(fromBook(book({ status: 'Reading' }))).status).toBe('Reading');
  });
});

describe('isDirty', () => {
  it('is false for a form straight off the row', () => {
    const row = book();
    expect(isDirty(fromBook(row), row)).toBe(false);
  });

  it('notices an edit to any editable field', () => {
    const row = book();
    expect(isDirty({ ...fromBook(row), notes: 'the wall is the whole book' }, row)).toBe(true);
    expect(isDirty({ ...fromBook(row), status: 'Readlist' }, row)).toBe(true);
    expect(isDirty({ ...fromBook(row), authors: ['Ursula K. Le Guin', 'Someone Else'] }, row)).toBe(true);
  });
});
