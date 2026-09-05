import { buildBookPayload, fromBook, isDirty, parsePrice, validate } from './bookForm';
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
    bookKey: 'manual:daft-punk|discovery',
    title: 'Discovery',
    authors: ['Daft Punk'],
    coverUrl: null,
    publishedDate: '2001-03-12',
    pageCount: 14,
    genres: [],
    url: '',
    formats: ['Hardcover'],
    status: 'Library',
    notes: '',
    favoriteQuotes: '',
    acquisitionDate: null,
    storeName: '',
    pricePaid: null,
    edition: '',
    customOrder: null,
    lastReadAt: null,
    addedAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('parsePrice', () => {
  it('reads a typed number, comma decimal included', () => {
    expect(parsePrice('24.99')).toBe(24.99);
    expect(parsePrice('24,99')).toBe(24.99);
  });

  it('reads an empty box as no price, not as zero', () => {
    expect(parsePrice('')).toBeNull();
    expect(parsePrice('   ')).toBeNull();
  });

  it('rejects nonsense and negatives', () => {
    expect(parsePrice('free')).toBeNull();
    expect(parsePrice('-5')).toBeNull();
  });
});

describe('validate', () => {
  it('accepts an untouched form off a real row', () => {
    expect(validate(fromBook(book()))).toEqual({});
  });

  it('demands a title', () => {
    expect(validate({ ...fromBook(book()), title: '  ' }).title).toBeDefined();
  });

  it('accepts an empty acquired date but not a malformed one', () => {
    expect(validate({ ...fromBook(book()), acquisitionDate: '' }).acquisitionDate).toBeUndefined();
    expect(validate({ ...fromBook(book()), acquisitionDate: '03/12/2001' }).acquisitionDate).toBeDefined();
  });

  it('flags a price that is not a number', () => {
    expect(validate({ ...fromBook(book()), pricePaid: 'a lot' }).pricePaid).toBeDefined();
  });
});

describe('buildBookPayload', () => {
  it('sends null rather than an empty string for the nullable columns', () => {
    const payload = buildBookPayload({ ...fromBook(book()), acquisitionDate: '', coverUrl: '', pricePaid: '' });
    expect(payload.acquisitionDate).toBeNull();
    expect(payload.coverUrl).toBeNull();
    expect(payload.pricePaid).toBeNull();
  });

  it('trims what the user typed', () => {
    const payload = buildBookPayload({ ...fromBook(book()), title: '  Homework  ', storeName: ' Rough Trade ' });
    expect(payload.title).toBe('Homework');
    expect(payload.storeName).toBe('Rough Trade');
  });

  it('treats a book with every format unticked as Paperback', () => {
    const payload = buildBookPayload({ ...fromBook(book()), formats: [] });
    expect(payload.formats).toEqual(['Paperback']);
  });
});

describe('isDirty', () => {
  it('is false for a form straight off the row', () => {
    const row = book();
    expect(isDirty(fromBook(row), row)).toBe(false);
  });

  it('notices an edit to any editable field', () => {
    const row = book();
    expect(isDirty({ ...fromBook(row), notes: 'scratchy but great' }, row)).toBe(true);
    expect(isDirty({ ...fromBook(row), formats: ['Hardcover', 'Ebook'] }, row)).toBe(true);
    expect(isDirty({ ...fromBook(row), status: 'Wishlist' }, row)).toBe(true);
  });
});
