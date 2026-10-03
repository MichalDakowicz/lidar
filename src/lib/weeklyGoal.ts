import { dateKey, weekStart, type WeeklyGoal } from '@/lib/streak';

/**
 * The weekly page goal as it changes over time.
 *
 * One number applied to the whole history is what makes a goal change rewrite
 * the past: raise 100 to 300 and every week you cleared in March stops
 * counting, so a streak you earned disappears. So a goal change has a scope, and
 * "from this week" keeps the weeks behind it on the number they were read under.
 *
 * The state is the goal as it stands now, plus the earlier goals as periods
 * that each say when they ended. Everything on the ending side of a period is
 * a Monday's `YYYY-MM-DD`, so the weeks line up with the streak's own weeks and
 * a key compares correctly as a plain string.
 *
 * Pure, so the rule that decides which weeks a change reaches is tested without
 * a renderer or a store.
 */
export type GoalPeriod = {
  /** First Monday this period no longer covers. Weeks starting before it used `pages`. */
  until: string;
  pages: number;
};

export type GoalState = {
  /** The goal now — every week from the last period's end onwards. */
  weeklyPages: number;
  /** Earlier goals, oldest first. Empty means one number for all of history. */
  history: GoalPeriod[];
};

/** How far a change reaches: the weeks from now on, or every week there is. */
export type GoalScope = 'from-now' | 'whole-history';

export const EMPTY_GOAL_HISTORY: GoalPeriod[] = [];

/** The goal for the week starting on this Monday key. */
export function goalForWeek(state: GoalState, weekKey: string): number {
  // Oldest first, so the first period still ahead of the week is the one it was
  // read under. Sorted here rather than trusted: the list is persisted, and a
  // bad clock when it was written is not worth a streak that jumps.
  const periods = [...state.history].sort((a, b) => (a.until < b.until ? -1 : a.until > b.until ? 1 : 0));
  for (const period of periods) {
    if (weekKey < period.until) return period.pages;
  }
  return state.weeklyPages;
}

/** The goal as the streak maths wants it: asked of a week's Monday. */
export function goalSchedule(state: GoalState): WeeklyGoal {
  if (state.history.length === 0) return state.weeklyPages;
  return (start: Date) => goalForWeek(state, dateKey(start));
}

/**
 * Change the goal, and say how far the change reaches.
 *
 * `from-now` starts at this week's Monday: this week and every one after it use
 * the new number, every earlier week keeps the one it had. This week is not left
 * on the old goal because it is not over — it is the week the reader is deciding
 * about, and judging it by a number they just replaced would answer a question
 * nobody asked.
 *
 * `whole-history` is what a single number always meant: the new goal for every
 * week, with no earlier periods left to disagree.
 */
export function changeGoal(state: GoalState, pages: number, scope: GoalScope, now: Date = new Date()): GoalState {
  if (scope === 'whole-history') return { weeklyPages: pages, history: [] };
  if (pages === state.weeklyPages) return state;

  const key = dateKey(weekStart(now));
  // A second change within the same week finds the weeks before it already
  // covered, so it only moves the goal from here on.
  const covered = state.history.some((period) => period.until >= key);
  const history = covered ? [...state.history] : [...state.history, { until: key, pages: state.weeklyPages }];

  // Changing back inside a week leaves a period equal to the goal that follows
  // it — the same number twice, which is one number.
  while (history.length > 0 && history[history.length - 1].pages === pages) history.pop();

  return { weeklyPages: pages, history };
}

/**
 * Whether any reading predates this week — the only case where "from now or the
 * whole history" is a question. With nothing behind this Monday the two answers
 * are the same, and asking would be noise.
 */
export function hasPastWeeks(daily: Record<string, number>, now: Date = new Date()): boolean {
  const key = dateKey(weekStart(now));
  return Object.keys(daily).some((day) => day < key);
}

/** The newest earlier goal, for the line that says what the past was counted against. */
export function latestPeriod(history: GoalPeriod[]): GoalPeriod | null {
  if (history.length === 0) return null;
  return history.reduce((latest, period) => (period.until > latest.until ? period : latest));
}
