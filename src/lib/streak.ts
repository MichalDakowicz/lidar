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
 * One forward move of a bookmark. Written by the page tracker (TODO item 7,
 * `public.book_progress`); until that lands this is always empty and the streak
 * runs on finished books alone.
 */
export type PageEntry = { recordedAt: string; pages: number };

/**
 * Pages read per local day, from both sources that know about pages.
 *
 * A finished read contributes the whole book on the day it was finished. That
 * is lumpy — 400 pages landing on a Tuesday — but it is the only thing the read
 * log actually knows, and it is honest: the alternative is inventing a reading
 * pace nobody recorded.
 *
 * A book with no page count contributes nothing rather than a guess. Re-reads
 * are separate rows and each carries its own `pageCount`, so re-reading a
 * different edition counts that edition's length, not the first one's.
 */
export function dailyPages(reads: Read[], progress: PageEntry[] = []): Record<string, number> {
  const daily: Record<string, number> = {};

  const add = (at: string, pages: number) => {
    if (!pages || pages <= 0) return;
    const parsed = Date.parse(at);
    if (Number.isNaN(parsed)) return;
    const key = dateKey(parsed);
    daily[key] = (daily[key] ?? 0) + pages;
  };

  for (const read of reads) add(read.finishedAt, read.pageCount ?? 0);
  for (const entry of progress) add(entry.recordedAt, entry.pages);

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
