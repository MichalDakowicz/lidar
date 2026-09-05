import {
  cleanIsbn,
  formatIsbn,
  isBooklandEan,
  isbn10To13,
  isbn13To10,
  isValidIsbn10,
  isValidIsbn13,
  parseIsbn,
} from '@/lib/isbn';

describe('cleanIsbn', () => {
  it('strips hyphens and spaces', () => {
    expect(cleanIsbn('978-0-14-118280-3')).toBe('9780141182803');
    expect(cleanIsbn(' 0 306 40615 2 ')).toBe('0306406152');
  });

  it('keeps the X check digit and uppercases it', () => {
    expect(cleanIsbn('043942089x')).toBe('043942089X');
  });

  it('survives null', () => {
    expect(cleanIsbn(null)).toBe('');
  });
});

describe('isValidIsbn10', () => {
  it('accepts a real ISBN-10', () => {
    expect(isValidIsbn10('0306406152')).toBe(true);
  });

  it('accepts an X check digit', () => {
    expect(isValidIsbn10('043942089X')).toBe(true);
  });

  it('rejects a transposed digit', () => {
    expect(isValidIsbn10('0306406125')).toBe(false);
  });

  it('rejects the wrong length', () => {
    expect(isValidIsbn10('030640615')).toBe(false);
  });
});

describe('isValidIsbn13', () => {
  it('accepts a real ISBN-13', () => {
    expect(isValidIsbn13('9780141182803')).toBe(true);
    expect(isValidIsbn13('9783161484100')).toBe(true);
  });

  it('rejects a single wrong digit', () => {
    expect(isValidIsbn13('9780141182804')).toBe(false);
  });

  it('rejects an X anywhere — ISBN-13 is digits only', () => {
    expect(isValidIsbn13('978014118280X')).toBe(false);
  });
});

describe('isBooklandEan', () => {
  it('accepts 978', () => {
    expect(isBooklandEan('9780141182803')).toBe(true);
  });

  it('rejects a grocery EAN even when its check digit is valid', () => {
    // 5449000000996 is a Coca-Cola can — a well-formed EAN-13, not a book.
    expect(isValidIsbn13('5449000000996')).toBe(true);
    expect(isBooklandEan('5449000000996')).toBe(false);
  });

  it('rejects 979-0, which is sheet music', () => {
    // 9790000000000 checks out arithmetically but is an ISMN.
    expect(isBooklandEan('9790000000000')).toBe(false);
  });
});

describe('isbn10To13 / isbn13To10', () => {
  it('round-trips a 978 book', () => {
    expect(isbn10To13('0306406152')).toBe('9780306406157');
    expect(isbn13To10('9780306406157')).toBe('0306406152');
  });

  it('converts an X check digit to its 13-digit form', () => {
    expect(isbn10To13('043942089X')).toBe('9780439420891');
  });

  it('refuses to make an ISBN-10 out of a 979 book — there is none', () => {
    expect(isbn13To10('9791234567896')).toBeNull();
  });
});

describe('parseIsbn', () => {
  it('normalises a typed ISBN-10 to the 13-digit key form', () => {
    expect(parseIsbn('0-306-40615-2')).toEqual({ isbn13: '9780306406157', isbn10: '0306406152' });
  });

  it('keeps a scanned ISBN-13 and derives the 10', () => {
    expect(parseIsbn('9780306406157')).toEqual({ isbn13: '9780306406157', isbn10: '0306406152' });
  });

  it('is null for anything that is not an ISBN', () => {
    expect(parseIsbn('hello')).toBeNull();
    expect(parseIsbn('9780141182804')).toBeNull();
    expect(parseIsbn('')).toBeNull();
  });

  it('keys a scan and a hand-typed ISBN-10 of the same edition identically', () => {
    expect(parseIsbn('9780306406157')?.isbn13).toBe(parseIsbn('0306406152')?.isbn13);
  });
});

describe('formatIsbn', () => {
  it('groups the fixed parts only', () => {
    expect(formatIsbn('9780306406157')).toBe('978-030640615-7');
    expect(formatIsbn('0306406152')).toBe('030640615-2');
  });
});
