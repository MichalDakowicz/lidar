import { guessKindFromGenres } from './genreKind';

describe('guessKindFromGenres', () => {
  it('calls biographies, memoirs and histories true accounts', () => {
    expect(guessKindFromGenres(['Biography & Autobiography'])).toBe('true');
    expect(guessKindFromGenres(['Memoirs'])).toBe('true');
    expect(guessKindFromGenres(['History'])).toBe('true');
    expect(guessKindFromGenres(['World War, 1939-1945', 'Personal narratives'])).toBe('true');
    expect(guessKindFromGenres(['True Crime'])).toBe('true');
  });

  it('reads Polish headings', () => {
    expect(guessKindFromGenres(['Biografie'])).toBe('true');
    expect(guessKindFromGenres(['Pamiętniki i wspomnienia'])).toBe('true');
    expect(guessKindFromGenres(['Wojna światowa'])).toBe('true');
    expect(guessKindFromGenres(['Powieść historyczna'])).toBe('story');
  });

  it('keeps fiction a story even when it borrows a true-account word', () => {
    expect(guessKindFromGenres(['Historical fiction'])).toBe('story');
    expect(guessKindFromGenres(['Fiction / War & Military'])).toBe('story');
    expect(guessKindFromGenres(['Biographical fiction'])).toBe('story');
    expect(guessKindFromGenres(['World War, 1939-1945 -- Fiction'])).toBe('story');
    expect(guessKindFromGenres(['Science Fiction', 'Fantasy'])).toBe('story');
  });

  it('does not mistake nonfiction for fiction', () => {
    expect(guessKindFromGenres(['Juvenile Nonfiction'])).toBe('true');
    expect(guessKindFromGenres(['Non-fiction'])).toBe('true');
  });

  it('falls back to a story when the catalogue says nothing', () => {
    expect(guessKindFromGenres([])).toBe('story');
    expect(guessKindFromGenres(null)).toBe('story');
    expect(guessKindFromGenres(undefined)).toBe('story');
    expect(guessKindFromGenres(['Cooking'])).toBe('story');
  });
});
