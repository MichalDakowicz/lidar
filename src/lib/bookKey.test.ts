import { authorList, bookKey, googleIdFromKey, isbnFromKey, isGoogleKey, isIsbnKey } from './bookKey';

describe('authorList', () => {
  it('keeps an array as-is, trimmed', () => {
    expect(authorList([' Ursula K. Le Guin ', 'Kōbō Abe', ''])).toEqual(['Ursula K. Le Guin', 'Kōbō Abe']);
  });

  it('splits a legacy semicolon string', () => {
    expect(authorList('Neil Gaiman; Terry Pratchett')).toEqual(['Neil Gaiman', 'Terry Pratchett']);
  });

  it('leaves a comma alone — plenty of names carry one', () => {
    expect(authorList('Martin Luther King, Jr.')).toEqual(['Martin Luther King, Jr.']);
  });

  it('reads nothing as no authors', () => {
    expect(authorList(null)).toEqual([]);
    expect(authorList(undefined)).toEqual([]);
  });
});

describe('bookKey', () => {
  it('prefers the ISBN over everything else', () => {
    expect(
      bookKey({ isbn13: '9780571228225', googleId: 'volume-abc', title: 'The Road', authors: ['Cormac McCarthy'] }),
    ).toBe('isbn:9780571228225');
  });

  it('normalises an ISBN-10 up, so a typed number keys the same as a scan', () => {
    const scanned = bookKey({ isbn13: '9780306406157', title: 'X', authors: ['Y'] });
    const typed = bookKey({ isbn10: '0-306-40615-2', title: 'X', authors: ['Y'] });
    expect(typed).toBe(scanned);
  });

  it('ignores an ISBN that fails its check digit and falls through', () => {
    expect(bookKey({ isbn13: '9780571228226', title: 'The Road', authors: ['Cormac McCarthy'] })).toBe(
      'manual:cormac-mccarthy|the-road',
    );
  });

  it('uses the Google volume id when there is no ISBN', () => {
    expect(bookKey({ googleId: 'volume-abc', title: 'Beowulf', authors: ['Anonymous'] })).toBe('gbooks:volume-abc');
  });

  it('keys a manual entry on the first author and the title', () => {
    expect(bookKey({ title: 'The Dispossessed', authors: ['Ursula K. Le Guin'] })).toBe(
      'manual:ursula-k-le-guin|the-dispossessed',
    );
  });

  it('ignores accents, case and punctuation so the same book keys once', () => {
    expect(bookKey({ title: 'Solaris!', authors: ['Stanisław Lem'] })).toBe(
      bookKey({ title: 'solaris', authors: ['Stanislaw Lem'] }),
    );
  });

  it('ignores a translator a later edition adds to the credits', () => {
    const original = bookKey({ title: 'The Trial', authors: ['Franz Kafka'] });
    const reissue = bookKey({ title: 'The Trial', authors: ['Franz Kafka', 'Idris Parry'] });
    expect(reissue).toBe(original);
  });

  it('falls back to unknown rather than an empty key', () => {
    expect(bookKey({ title: 'Untitled' })).toBe('manual:unknown|untitled');
  });
});

describe('key helpers', () => {
  it('reads an ISBN back out', () => {
    expect(isbnFromKey('isbn:9780571228225')).toBe('9780571228225');
    expect(isIsbnKey('isbn:9780571228225')).toBe(true);
    expect(isbnFromKey('manual:franz-kafka|the-trial')).toBeNull();
  });

  it('reads a Google volume id back out', () => {
    expect(googleIdFromKey('gbooks:abc123')).toBe('abc123');
    expect(googleIdFromKey('manual:franz-kafka|the-trial')).toBeNull();
    expect(isGoogleKey('gbooks:abc123')).toBe(true);
  });
});
