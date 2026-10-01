import type { ReminderLine } from '@/lib/reminderPlan';

/**
 * Everything the daily reminder says in Lidar's voice: the notification itself
 * and the Settings control that switches it on. The mechanics around it are
 * identical in Sonar; only this file differs.
 */

export const REMINDER_TEXT = {
  title: 'Reading reminder',
  description: 'A nudge each evening to read a few pages. Skipped on days you have already logged some.',
  channelName: 'Reading reminder',
  channelDescription: 'A daily nudge to read',
  /** Shown when the OS has notifications off. */
  blocked: "Android is blocking Lidar's reminders. Tap to allow them.",
  /** Shown where there is no queue to schedule into. */
  needsApp: 'Reminders need the Android app. This switch only takes effect there.',
} as const;

/** One a day, rotating, so a week of the same sentence does not teach anyone to ignore it. */
export const REMINDER_LINES: readonly ReminderLine[] = [
  { title: 'Time to read', body: 'A few pages tonight keeps your week on track' },
  { title: 'Your book is waiting', body: 'Pick it up where you left off' },
  { title: 'Ten minutes with a book?', body: 'Even a short stretch counts toward your streak' },
  { title: 'A quiet hour ahead', body: 'A good moment to open your book' },
  { title: 'Where did you get to?', body: 'Log a few pages and keep the streak going' },
];
