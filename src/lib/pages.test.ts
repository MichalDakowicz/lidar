import { countablePages, firstPage, pagesReadAt, progressRatio } from './pages';

const span = (pageCount: number | null, startPage: number | null) => ({ pageCount, startPage });
const at = (pageCount: number | null, startPage: number | null, currentPage: number | null) => ({
  pageCount,
  startPage,
  currentPage,
});

describe('firstPage', () => {
  it('is 1 when the book does not say otherwise', () => {
    expect(firstPage(span(384, null))).toBe(1);
  });

  it('ignores a nonsense start page', () => {
    expect(firstPage(span(384, 0))).toBe(1);
  });

  it('is the recorded start page', () => {
    expect(firstPage(span(384, 17))).toBe(17);
  });
});

describe('countablePages', () => {
  it('is the whole book when it starts on page 1', () => {
    expect(countablePages(span(384, null))).toBe(384);
  });

  it('drops the front matter', () => {
    expect(countablePages(span(384, 17))).toBe(368);
  });

  it('counts a one-page book', () => {
    expect(countablePages(span(17, 17))).toBe(1);
  });

  it('has nothing to count without a page count', () => {
    expect(countablePages(span(null, 17))).toBeNull();
    expect(countablePages(span(0, null))).toBeNull();
  });

  it('falls back to the raw count when the start is past the end', () => {
    expect(countablePages(span(384, 400))).toBe(384);
  });
});

describe('pagesReadAt', () => {
  it('counts the page you are on', () => {
    expect(pagesReadAt(span(384, 17), 17)).toBe(1);
    expect(pagesReadAt(span(384, 17), 214)).toBe(198);
  });

  it('counts nothing in the front matter', () => {
    expect(pagesReadAt(span(384, 17), 5)).toBe(0);
  });

  it('clamps a bookmark past the end', () => {
    expect(pagesReadAt(span(384, 17), 500)).toBe(368);
  });

  it('is nothing without a bookmark or a page count', () => {
    expect(pagesReadAt(span(384, 17), null)).toBe(0);
    expect(pagesReadAt(span(null, 17), 200)).toBe(0);
  });
});

describe('progressRatio', () => {
  it('is null when there is no bar to draw', () => {
    expect(progressRatio(at(null, null, 100))).toBeNull();
    expect(progressRatio(at(384, 17, null))).toBeNull();
  });

  it('reaches 1 on the last page', () => {
    expect(progressRatio(at(384, 17, 384))).toBe(1);
  });

  it('measures from the start page, not from zero', () => {
    // Halfway through 368 countable pages is page 200, not page 192.
    expect(progressRatio(at(384, 17, 200))).toBeCloseTo(0.5, 2);
  });
});
