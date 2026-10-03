import { currentStreak, longestStreak, weekShortfall } from './streak';
import { changeGoal, goalForWeek, goalSchedule, hasPastWeeks, latestPeriod, type GoalState } from './weeklyGoal';

// 2026-06-10 is a Wednesday; its week starts Monday 2026-06-08.
const WED = new Date('2026-06-10T12:00:00');
const THIS_MONDAY = '2026-06-08';

const flat = (pages: number): GoalState => ({ weeklyPages: pages, history: [] });

describe('goalForWeek', () => {
  it('is the one number when nothing has ever changed', () => {
    expect(goalForWeek(flat(150), '2020-01-06')).toBe(150);
    expect(goalForWeek(flat(150), THIS_MONDAY)).toBe(150);
  });

  it('gives weeks before a period ends that period’s goal, and the rest the current one', () => {
    const state: GoalState = { weeklyPages: 300, history: [{ until: THIS_MONDAY, pages: 100 }] };
    expect(goalForWeek(state, '2026-06-01')).toBe(100);
    expect(goalForWeek(state, THIS_MONDAY)).toBe(300);
    expect(goalForWeek(state, '2026-06-15')).toBe(300);
  });

  it('walks several periods oldest first, whatever order they were stored in', () => {
    const state: GoalState = {
      weeklyPages: 50,
      history: [
        { until: '2026-06-08', pages: 200 },
        { until: '2026-05-04', pages: 100 },
      ],
    };
    expect(goalForWeek(state, '2026-04-27')).toBe(100);
    expect(goalForWeek(state, '2026-05-04')).toBe(200);
    expect(goalForWeek(state, '2026-06-01')).toBe(200);
    expect(goalForWeek(state, '2026-06-08')).toBe(50);
  });
});

describe('changeGoal, from now', () => {
  it('keeps every earlier week on the old goal and starts the new one this Monday', () => {
    const next = changeGoal(flat(100), 300, 'from-now', WED);
    expect(next.weeklyPages).toBe(300);
    expect(next.history).toEqual([{ until: THIS_MONDAY, pages: 100 }]);
    expect(goalForWeek(next, '2026-06-01')).toBe(100);
    expect(goalForWeek(next, THIS_MONDAY)).toBe(300);
  });

  it('judges this week by the new goal, even though it is half over', () => {
    const next = changeGoal(flat(100), 300, 'from-now', new Date('2026-06-14T12:00:00'));
    expect(goalForWeek(next, THIS_MONDAY)).toBe(300);
  });

  it('is a no-op when the number does not change', () => {
    const state = flat(100);
    expect(changeGoal(state, 100, 'from-now', WED)).toBe(state);
  });

  it('moves only the goal on a second change in the same week, leaving the past alone', () => {
    const once = changeGoal(flat(100), 300, 'from-now', WED);
    const twice = changeGoal(once, 250, 'from-now', new Date('2026-06-12T12:00:00'));
    expect(twice.weeklyPages).toBe(250);
    expect(twice.history).toEqual([{ until: THIS_MONDAY, pages: 100 }]);
  });

  it('stacks a period on a change in a later week', () => {
    const once = changeGoal(flat(100), 300, 'from-now', WED);
    const later = changeGoal(once, 200, 'from-now', new Date('2026-06-17T12:00:00'));
    expect(later.history).toEqual([
      { until: '2026-06-08', pages: 100 },
      { until: '2026-06-15', pages: 300 },
    ]);
    expect(later.weeklyPages).toBe(200);
  });

  it('drops the period again when the goal is changed back in the same week', () => {
    const once = changeGoal(flat(100), 300, 'from-now', WED);
    expect(changeGoal(once, 100, 'from-now', WED)).toEqual(flat(100));
  });
});

describe('changeGoal, whole history', () => {
  it('is the old behaviour: one number for every week', () => {
    const next = changeGoal(flat(100), 300, 'whole-history', WED);
    expect(next).toEqual(flat(300));
    expect(goalForWeek(next, '2020-01-06')).toBe(300);
  });

  it('clears earlier periods, so it also undoes a from-now change', () => {
    const split = changeGoal(flat(100), 300, 'from-now', WED);
    expect(changeGoal(split, split.weeklyPages, 'whole-history', WED)).toEqual(flat(300));
  });
});

describe('goalSchedule', () => {
  it('is a plain number while there is no history', () => {
    expect(goalSchedule(flat(150))).toBe(150);
  });

  it('answers per week once there is', () => {
    const goal = goalSchedule(changeGoal(flat(100), 300, 'from-now', WED));
    expect(typeof goal).toBe('function');
    if (typeof goal === 'function') {
      expect(goal(new Date('2026-06-01T00:00:00'))).toBe(100);
      expect(goal(new Date('2026-06-08T00:00:00'))).toBe(300);
    }
  });
});

describe('the streak under a goal that changed', () => {
  // Last week (Mon 2026-06-01) cleared 100 comfortably: 120 pages on three days.
  const daily = { '2026-06-01': 40, '2026-06-03': 40, '2026-06-05': 40, '2026-06-09': 30 };

  it('loses last week when the new goal is applied to the whole history', () => {
    expect(currentStreak(daily, 300, WED)).toBe(1);
    expect(longestStreak(daily, 300)).toBe(0);
  });

  it('keeps last week when the new goal only starts this Monday', () => {
    const goal = goalSchedule(changeGoal(flat(100), 300, 'from-now', WED));
    expect(currentStreak(daily, goal, WED)).toBe(4);
    expect(longestStreak(daily, goal)).toBe(3);
  });

  it('asks this week’s pages against this week’s goal', () => {
    const goal = goalSchedule(changeGoal(flat(100), 300, 'from-now', WED));
    expect(weekShortfall(daily, goal, WED)).toEqual({ weekStart: THIS_MONDAY, needed: 270, read: 30 });
  });
});

describe('hasPastWeeks', () => {
  it('is false with nothing read, or only this week', () => {
    expect(hasPastWeeks({}, WED)).toBe(false);
    expect(hasPastWeeks({ '2026-06-08': 20, '2026-06-10': 5 }, WED)).toBe(false);
  });

  it('is true as soon as one earlier day has pages', () => {
    expect(hasPastWeeks({ '2026-06-07': 20 }, WED)).toBe(true);
  });
});

describe('latestPeriod', () => {
  it('is null with no history, and the newest end otherwise', () => {
    expect(latestPeriod([])).toBeNull();
    expect(
      latestPeriod([
        { until: '2026-06-15', pages: 300 },
        { until: '2026-06-08', pages: 100 },
      ]),
    ).toEqual({ until: '2026-06-15', pages: 300 });
  });
});
