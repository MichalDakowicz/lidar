import { currentStreak, dailyPages, dateKey, longestStreak, pagesInWeek, weekShortfall, weekStart } from './streak';
import type { Read } from '@/types/book';

function read(finishedAt: string, pageCount: number | null, overrides: Partial<Read> = {}): Read {
  return {
    id: `${finishedAt}-${pageCount}`,
    userId: 'u',
    bookId: 'b',
    bookKey: 'isbn:9780000000001',
    title: 'A book',
    authors: [],
    coverUrl: null,
    startedAt: null,
    finishedAt,
    pageCount,
    ...overrides,
  };
}

/** Local noon, so a timezone offset cannot shift the day under the test. */
function at(iso: string): string {
  return new Date(`${iso}T12:00:00`).toISOString();
}

describe('weekStart', () => {
  it('anchors on Monday, and treats Sunday as the end of its week', () => {
    // 2026-06-03 is a Wednesday; 2026-06-07 the Sunday after it.
    expect(dateKey(weekStart(new Date('2026-06-03T12:00:00')))).toBe('2026-06-01');
    expect(dateKey(weekStart(new Date('2026-06-07T12:00:00')))).toBe('2026-06-01');
    expect(dateKey(weekStart(new Date('2026-06-08T12:00:00')))).toBe('2026-06-08');
  });
});

describe('pagesInWeek', () => {
  it('sums a week that straddles a month boundary', () => {
    // Mon 2026-06-29 .. Sun 2026-07-05 — four days in June, three in July.
    const daily = { '2026-06-29': 40, '2026-06-30': 60, '2026-07-01': 50, '2026-07-05': 30 };
    expect(pagesInWeek(daily, weekStart(new Date('2026-07-02T12:00:00')))).toBe(180);
  });

  it('does not bleed into the week either side of the boundary', () => {
    const daily = { '2026-06-28': 999, '2026-07-06': 999, '2026-06-29': 10 };
    expect(pagesInWeek(daily, weekStart(new Date('2026-07-02T12:00:00')))).toBe(10);
  });
});

describe('dailyPages', () => {
  it('buckets a finished read on the day it was finished', () => {
    expect(dailyPages([read(at('2026-06-01'), 320)])['2026-06-01']).toBe(320);
  });

  it('counts a re-read of a different edition at that edition’s length', () => {
    const daily = dailyPages([
      read(at('2026-06-01'), 320, { id: 'first' }),
      read(at('2026-09-01'), 288, { id: 'reread', bookKey: 'isbn:9780000000002' }),
    ]);
    expect(daily['2026-06-01']).toBe(320);
    expect(daily['2026-09-01']).toBe(288);
  });

  it('adds two finishes on the same day together', () => {
    const daily = dailyPages([read(at('2026-06-01'), 120, { id: 'a' }), read(at('2026-06-01'), 80, { id: 'b' })]);
    expect(daily['2026-06-01']).toBe(200);
  });

  it('contributes nothing for a book with no page count, rather than guessing', () => {
    expect(dailyPages([read(at('2026-06-01'), null)])).toEqual({});
  });

  it('folds in bookmark moves alongside finished reads', () => {
    const daily = dailyPages([read(at('2026-06-01'), 100)], [{ recordedAt: at('2026-06-01'), pages: 45 }]);
    expect(daily['2026-06-01']).toBe(145);
  });

  it('leaves out everything before a streak reset', () => {
    const reads = [read(at('2026-06-01'), 320, { id: 'old' }), read(at('2026-09-01'), 288, { id: 'new' })];
    const daily = dailyPages(reads, [], at('2026-08-01'));
    expect(daily['2026-06-01']).toBeUndefined();
    expect(daily['2026-09-01']).toBe(288);
  });

  it('keeps a read finished exactly on the reset', () => {
    const daily = dailyPages([read(at('2026-08-01'), 200)], [], at('2026-08-01'));
    expect(daily['2026-08-01']).toBe(200);
  });

  it('cuts bookmark moves off at the reset too', () => {
    const daily = dailyPages([], [{ recordedAt: at('2026-06-01'), pages: 45 }], at('2026-08-01'));
    expect(daily).toEqual({});
  });

  it('counts everything when there is no reset, or the reset is unparseable', () => {
    const reads = [read(at('2026-06-01'), 320)];
    expect(dailyPages(reads, [], null)['2026-06-01']).toBe(320);
    expect(dailyPages(reads, [], 'not a date')['2026-06-01']).toBe(320);
  });
});

// The ledger and the read log both know about pages, and a book tracked page by
// page then finished would otherwise contribute its whole length twice.
describe('dailyPages, ledger against read log', () => {
  it('lets the ledger own a book that was tracked, and counts the read at nothing', () => {
    const daily = dailyPages(
      [read(at('2026-06-05'), 320)],
      [
        { recordedAt: at('2026-06-01'), pages: 100, bookId: 'b' },
        { recordedAt: at('2026-06-03'), pages: 140, bookId: 'b' },
        // What 'Finished' writes: only the pages left between the bookmark and
        // the last page (lib/progress.closingMove).
        { recordedAt: at('2026-06-05'), pages: 80, bookId: 'b' },
      ],
    );
    expect(daily['2026-06-01']).toBe(100);
    expect(daily['2026-06-03']).toBe(140);
    expect(daily['2026-06-05']).toBe(80);
    expect(Object.values(daily).reduce((a, b) => a + b, 0)).toBe(320);
  });

  it('still counts a read with no ledger behind it — an import, or a book just marked finished', () => {
    const daily = dailyPages(
      [read(at('2026-06-05'), 320, { bookId: 'untracked' })],
      [{ recordedAt: at('2026-06-01'), pages: 100, bookId: 'other' }],
    );
    expect(daily['2026-06-05']).toBe(320);
  });

  it('counts a re-read that was never tracked, even though the first read was', () => {
    const daily = dailyPages(
      [read(at('2026-06-05'), 320, { id: 'first' }), read(at('2026-09-05'), 320, { id: 'again' })],
      [{ recordedAt: at('2026-06-05'), pages: 320, bookId: 'b' }],
    );
    expect(daily['2026-06-05']).toBe(320);
    expect(daily['2026-09-05']).toBe(320);
  });

  it('ignores a ledger row recorded after the read it might have covered', () => {
    const daily = dailyPages(
      [read(at('2026-06-05'), 320)],
      [{ recordedAt: at('2026-07-01'), pages: 40, bookId: 'b' }],
    );
    expect(daily['2026-06-05']).toBe(320);
    expect(daily['2026-07-01']).toBe(40);
  });
});

describe('currentStreak', () => {
  const now = new Date('2026-06-03T12:00:00'); // Wednesday

  it('is zero with nothing read', () => {
    expect(currentStreak({}, 150, now)).toBe(0);
  });

  it('counts the current week on any pages at all, because it is not over', () => {
    const daily = { '2026-06-01': 20, '2026-06-02': 20, '2026-06-03': 20 };
    expect(currentStreak(daily, 150, now)).toBe(3);
  });

  it('skips an empty day while its week still clears the threshold', () => {
    // Previous week (Mon 2026-05-25..Sun 05-31) totals 200, over the threshold,
    // so the blank Thursday inside it does not end the run.
    const daily = {
      '2026-06-01': 30,
      '2026-05-31': 50,
      '2026-05-30': 50,
      // 2026-05-29 blank
      '2026-05-28': 100,
    };
    expect(currentStreak(daily, 150, now)).toBe(4);
  });

  it('stops at a past week that fell short of the threshold', () => {
    const daily = { '2026-06-01': 30, '2026-05-31': 10, '2026-05-30': 10 };
    expect(currentStreak(daily, 150, now)).toBe(1);
  });
});

describe('longestStreak', () => {
  it('finds the best historical run, not the current one', () => {
    const daily = {
      '2026-05-25': 200,
      '2026-05-26': 200,
      '2026-05-27': 200,
      // a fortnight of nothing
      '2026-06-15': 200,
    };
    expect(longestStreak(daily, 150)).toBe(3);
  });
});

describe('weekShortfall', () => {
  it('reports what is still owed this week', () => {
    const now = new Date('2026-06-03T12:00:00');
    expect(weekShortfall({ '2026-06-01': 40 }, 150, now)).toEqual({
      weekStart: '2026-06-01',
      needed: 110,
      read: 40,
    });
  });

  it('reports nothing owed once the threshold is met', () => {
    const now = new Date('2026-06-03T12:00:00');
    expect(weekShortfall({ '2026-06-01': 400 }, 150, now).needed).toBe(0);
  });
});
