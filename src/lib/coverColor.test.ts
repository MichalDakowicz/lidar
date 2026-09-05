import { coverPalette, coverTitle, hashKey } from './coverColor';

describe('hashKey', () => {
  it('is stable for the same key', () => {
    expect(hashKey('isbn:9788381965453')).toBe(hashKey('isbn:9788381965453'));
  });

  it('separates keys that differ by one digit', () => {
    expect(hashKey('isbn:9788381965453')).not.toBe(hashKey('isbn:9788381965454'));
  });
});

describe('coverPalette', () => {
  it('gives one book one colour, every time', () => {
    expect(coverPalette('isbn:1')).toEqual(coverPalette('isbn:1'));
  });

  it('keeps saturation and lightness pinned so covers sit at one weight', () => {
    for (const key of ['isbn:1', 'isbn:2', 'manual:a|b', 'gbooks:xyz']) {
      expect(coverPalette(key).background).toMatch(/^hsl\(\d{1,3} 32% 22%\)$/);
    }
  });
});

describe('coverTitle', () => {
  it('leaves a short title alone', () => {
    expect(coverTitle('Dżuma')).toBe('Dżuma');
  });

  it('trims a long title on a word boundary', () => {
    const trimmed = coverTitle('The Left Hand of Darkness and Other Stories From Gethen', 24);
    expect(trimmed.endsWith('…')).toBe(true);
    expect(trimmed).not.toMatch(/\s…$/);
    expect(trimmed.length).toBeLessThanOrEqual(25);
  });

  it('falls back to a hard cut when there is no space to break on', () => {
    expect(coverTitle('Supercalifragilisticexpialidocious', 10)).toBe('Supercalif…');
  });
});
