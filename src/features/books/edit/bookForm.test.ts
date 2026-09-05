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
    startPage: null,
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

describe('page fields', () => {
  const form = () => fromBook(book());

  it('carries the page count and start page out of the book as text', () => {
    const f = fromBook(book({ pageCount: 384, startPage: 17 }));
    expect(f.pageCount).toBe('384');
    expect(f.startPage).toBe('17');
  });

  it('leaves an unknown page count blank rather than 0', () => {
    const f = fromBook(book({ pageCount: null, startPage: null }));
    expect(f.pageCount).toBe('');
    expect(f.startPage).toBe('');
  });

  it('writes a blank field back as null, not 0', () => {
    const payload = buildBookPayload({ ...form(), pageCount: '', startPage: '' });
    expect(payload.pageCount).toBeNull();
    expect(payload.startPage).toBeNull();
  });

  it('writes what was typed', () => {
    const payload = buildBookPayload({ ...form(), pageCount: '384', startPage: '17' });
    expect(payload.pageCount).toBe(384);
    expect(payload.startPage).toBe(17);
  });

  it('refuses a story that starts after the last page', () => {
    expect(validate({ ...form(), pageCount: '384', startPage: '400' }).startPage).toBe(
      'The story cannot start after page 384',
    );
  });

  it('accepts a story that starts on the last page', () => {
    expect(validate({ ...form(), pageCount: '384', startPage: '384' }).startPage).toBeUndefined();
  });

  it('refuses something that is not a page number', () => {
    expect(validate({ ...form(), startPage: 'x' }).startPage).toBeDefined();
    expect(validate({ ...form(), pageCount: '0' }).pageCount).toBeDefined();
  });

  it('is dirty when only the start page moved', () => {
    const original = book({ pageCount: 384, startPage: null });
    expect(isDirty({ ...fromBook(original), startPage: '17' }, original)).toBe(true);
  });
});
