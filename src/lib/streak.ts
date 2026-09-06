import type { Read } from '@/types/book';

/**
 * The reading streak, measured in **pages per week**.
 *
 * Radar counts completions: a film is two hours, so one finished title a week
 * is a real habit. A book is not — someone reading one 900-page novel a month
 * reads every night and would show a streak of zero under that rule, while
 * someone finishing four novellas in a weekend would look prolific. Pages are
 * the unit that survives both.
 *
 * The maths below is Radar's, verbatim, because it never cared what the number
 * in each day's bucket meant: a day contributes when it has activity and its
 * week clears the threshold, and an empty day is skipped rather than fatal for
 * as long as its week still qualifies. That is the whole point of a weekly
 * threshold — an evening off is not a broken habit.
 */

/** `YYYY-MM-DD` in local time: "what did I read yesterday" is a local question. */
export function dateKey(input: string | number | Date): string {
  const d = new Date(input);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Monday-anchored start-of-week at 00:00 local. */
export function weekStart(input: Date): Date {
  const d = new Date(input);
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1; // Sunday -> back 6, else back to Monday
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** How many pages a Monday-anchored week holds. */
export function pagesInWeek(daily: Record<string, number>, start: Date): number {
  let total = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    total += daily[dateKey(d)] || 0;
  }
  return total;
}

/**
 * One forward move of a bookmark — a row of the page ledger
 * (`public.book_progress`, written by the page tracker).
 */
export type PageEntry = { recordedAt: string; pages: number; bookId?: string | null };

/** Every ledger stamp for one book, oldest first. */
function stampsByBook(progress: PageEntry[]): Map<string, number[]> {
  const byBook = new Map<string, number[]>();
  for (const entry of progress) {
    if (!entry.bookId) continue;
    const at = Date.parse(entry.recordedAt);
    if (Number.isNaN(at)) continue;
    const list = byBook.get(entry.bookId);
    if (list) list.push(at);
    else byBook.set(entry.bookId, [at]);
  }
  for (const list of byBook.values()) list.sort((a, b) => a - b);
  return byBook;
}

/**
 * Whether the ledger already accounts for a read, so the read must not be
 * counted a second time.
 *
 * The window is everything since the previous finish of the same book: pages
 * tracked towards *this* read. A re-read logged with no page tracking of its
 * own therefore still counts as a lump, even though the first read of the same
 * book was tracked page by page.
 */
function ledgerCovers(stamps: number[] | undefined, since: number, until: number): boolean {
  if (!stamps) return false;
  return stamps.some((at) => at > since && at <= until);
}

/**
 * Pages read per local day, from both sources that know about pages.
 *
 * The ledger is preferred wherever it exists: a book tracked page by page
 * contributes on the evenings it was actually read, and the read row that
 * finishes it adds nothing, because "Finished" already wrote a closing ledger
 * row for whatever was left (lib/progress.closingMove). Without that rule a
 * tracked book would count its whole length twice.
 *
 * A read with no ledger behind it — imported, or a book simply marked finished
 * — still contributes its whole page count on the day it was finished. That is
 * lumpy, 400 pages landing on a Tuesday, but it is the only thing the read log
 * knows, and the alternative is inventing a reading pace nobody recorded.
 *
 * A book with no page count contributes nothing rather than a guess. Re-reads
 * are separate rows and each carries its own `pageCount`, so re-reading a
 * different edition counts that edition's length, not the first one's.
 *
 * `since` is the streak reset (store/streakEpoch): anything recorded before it
 * is left out of the habit surfaces and out of nothing else. The read is still
 * a read, still on the shelf, still in the year's page total — the calendar
 * simply starts drawing from the day you asked it to.
 */
export function dailyPages(
  reads: Read[],
  progress: PageEntry[] = [],
  since: string | null = null,
): Record<string, number> {
  const daily: Record<string, number> = {};
  const floor = since ? Date.parse(since) : NaN;
  const cutoff = Number.isNaN(floor) ? null : floor;

  const add = (at: number, pages: number) => {
    if (!pages || pages <= 0) return;
    if (cutoff !== null && at < cutoff) return;
    const key = dateKey(at);
    daily[key] = (daily[key] ?? 0) + pages;
  };

  for (const entry of progress) {
    const at = Date.parse(entry.recordedAt);
    if (!Number.isNaN(at)) add(at, entry.pages);
  }

  const stamps = stampsByBook(progress);
  // Oldest first, so each read knows where the previous one left off.
  const ordered = [...reads]
    .map((read) => ({ read, at: Date.parse(read.finishedAt) }))
    .filter((entry) => !Number.isNaN(entry.at))
    .sort((a, b) => a.at - b.at);
  const previous = new Map<string, number>();

  for (const { read, at } of ordered) {
    const bookId = read.bookId;
    const from = bookId ? (previous.get(bookId) ?? Number.NEGATIVE_INFINITY) : Number.NEGATIVE_INFINITY;
    if (bookId) previous.set(bookId, at);
    if (bookId && ledgerCovers(stamps.get(bookId), from, at)) continue;
    add(at, read.pageCount ?? 0);
  }

  return daily;
}

/**
 * Consecutive-day streak walking back from `now`. A day contributes when pages
 * were read and its week meets `threshold`; the current week counts with any
 * pages at all, because it is not over yet and failing someone on Tuesday for a
 * week they can still finish is the daily-nag bug.
 */
export function currentStreak(daily: Record<string, number>, threshold: number, now: Date = new Date()): number {
  if (Object.keys(daily).length === 0) return 0;

  const thisWeekStart = weekStart(now).getTime();
  let streak = 0;
  const cursor = new Date(now);

  for (;;) {
    const start = weekStart(cursor);
    const inWeek = pagesInWeek(daily, start);
    const isCurrentWeek = start.getTime() === thisWeekStart;
    const weekQualifies = inWeek >= threshold || (isCurrentWeek && inWeek > 0);

    if ((daily[dateKey(cursor)] || 0) > 0) {
      if (!weekQualifies) break;
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    } else if (weekQualifies) {
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

/** Longest historical run under the same weekly-threshold rule. */
export function longestStreak(daily: Record<string, number>, threshold: number): number {
  const keys = Object.keys(daily).sort();
  if (keys.length === 0) return 0;

  const cursor = new Date(keys[0]);
  const end = new Date(keys[keys.length - 1]);
  let run = 0;
  let longest = 0;

  while (cursor <= end) {
    const inWeek = pagesInWeek(daily, weekStart(cursor));
    if ((daily[dateKey(cursor)] || 0) > 0) {
      if (inWeek >= threshold) {
        run++;
        longest = Math.max(longest, run);
      }
    } else if (inWeek < threshold) {
      run = 0;
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return longest;
}

/** Pages still owed this week to keep the streak alive. 0 means safe. */
export function weekShortfall(
  daily: Record<string, number>,
  threshold: number,
  now: Date = new Date(),
): { weekStart: string; needed: number; read: number } {
  const start = weekStart(now);
  const read = pagesInWeek(daily, start);
  return { weekStart: dateKey(start), needed: Math.max(0, threshold - read), read };
}
