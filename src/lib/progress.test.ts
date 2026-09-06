import { closingMove, displayPage, pagesGained, planPageMove, resolveTypedPage } from './progress';
import type { Book } from '@/types/book';

type Span = Pick<Book, 'pageCount' | 'startPage' | 'currentPage'>;

function span(overrides: Partial<Span> = {}): Span {
  return { pageCount: 384, startPage: null, currentPage: null, ...overrides };
}

describe('resolveTypedPage / displayPage', () => {
  it('stores what was typed when the reader means the page they finished', () => {
    expect(resolveTypedPage(214, 'finished')).toBe(214);
  });

  it('stores one less when the reader means the page they will open on', () => {
    expect(resolveTypedPage(214, 'next')).toBe(213);
  });

  it('round-trips: the same physical position types back as it was typed', () => {
    for (const mode of ['finished', 'next'] as const) {
      expect(displayPage(resolveTypedPage(214, mode), mode)).toBe(214);
    }
  });

  it('shows nothing for a book with no bookmark', () => {
    expect(displayPage(null, 'next')).toBeNull();
  });
});

describe('pagesGained', () => {
  it('counts the pages between two bookmarks', () => {
    expect(pagesGained(span(), 120, 214)).toBe(94);
  });

  it('counts from the start page, not from zero', () => {
    expect(pagesGained(span({ startPage: 17 }), null, 17)).toBe(1);
    expect(pagesGained(span({ startPage: 17 }), 17, 116)).toBe(99);
  });

  it('never returns a negative — a bookmark moved back is a correction', () => {
    expect(pagesGained(span(), 214, 120)).toBe(0);
  });

  it('clamps to the length of the book', () => {
    expect(pagesGained(span({ pageCount: 100 }), null, 400)).toBe(100);
  });

  it('is zero when the edition has no page count to measure against', () => {
    expect(pagesGained(span({ pageCount: null }), 10, 200)).toBe(0);
  });
});

describe('planPageMove', () => {
  it('reads a forward move and prices it', () => {
    const move = planPageMove(span({ currentPage: 120 }), '214', 'finished');
    expect(move).toMatchObject({ from: 120, to: 214, pages: 94, valid: true, backwards: false, unchanged: false });
  });

  it('is off by one between the two modes, which is the point of the toggle', () => {
    const finished = planPageMove(span({ currentPage: 120 }), '214', 'finished');
    const next = planPageMove(span({ currentPage: 120 }), '214', 'next');
    expect(next.to).toBe(finished.to! - 1);
    expect(next.pages).toBe(finished.pages - 1);
  });

  it('refuses a page past the end of the edition', () => {
    const move = planPageMove(span({ currentPage: 120 }), '900', 'finished');
    expect(move.beyondEnd).toBe(true);
    expect(move.valid).toBe(false);
  });

  it('accepts a backwards move but prices it at nothing', () => {
    const move = planPageMove(span({ currentPage: 214 }), '120', 'finished');
    expect(move).toMatchObject({ backwards: true, pages: 0, valid: true });
  });

  it('reads an empty field as clearing the bookmark', () => {
    const move = planPageMove(span({ currentPage: 214 }), '  ', 'finished');
    expect(move).toMatchObject({ to: null, pages: 0, valid: true, unchanged: false });
  });

  it('calls the same page unchanged, so Save has nothing to do', () => {
    expect(planPageMove(span({ currentPage: 214 }), '214', 'finished').unchanged).toBe(true);
  });

  it('rejects anything that is not a page number', () => {
    for (const raw of ['2f', '-4', '12.5', 'two hundred']) {
      expect(planPageMove(span(), raw, 'finished').valid).toBe(false);
    }
  });

  it('accepts the start page in "next page" mode as nothing read yet', () => {
    const move = planPageMove(span({ startPage: 17 }), '17', 'next');
    expect(move).toMatchObject({ to: 16, pages: 0, valid: true });
  });

  it('rejects a page before the book begins', () => {
    expect(planPageMove(span({ startPage: 17 }), '3', 'finished').valid).toBe(false);
  });
});

describe('closingMove', () => {
  it('bills only what is left when the book was tracked to page 300', () => {
    expect(closingMove(span({ currentPage: 300 }))).toEqual({ page: 384, pages: 84 });
  });

  it('bills the whole book when it was never tracked', () => {
    expect(closingMove(span())).toEqual({ page: 384, pages: 384 });
  });

  it('bills from the start page, so front matter is not read twice', () => {
    expect(closingMove(span({ startPage: 17 }))).toEqual({ page: 384, pages: 368 });
  });

  it('bills nothing for an edition with no page count', () => {
    expect(closingMove(span({ pageCount: null, currentPage: 40 }))).toEqual({ page: null, pages: 0 });
  });

  it('bills nothing twice when the bookmark is already on the last page', () => {
    expect(closingMove(span({ currentPage: 384 })).pages).toBe(0);
  });
});
