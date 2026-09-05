import { useReadingGoal, WEEKLY_PAGE_OPTIONS } from '@/store/readingGoal';

import { Segmented } from './Segmented';
import { SettingLabel } from './SettingsSection';

const OPTIONS = WEEKLY_PAGE_OPTIONS.map((value) => ({ value, label: String(value) }));

/**
 * Pages a week the reading streak asks for. A week that clears it keeps the
 * streak alive even with nights off — see lib/streak — so this is the dial
 * between "a habit I can keep" and "a target I will miss".
 */
export function WeeklyGoalControl() {
  const { weeklyPages, setWeeklyPages } = useReadingGoal();
  return (
    <>
      <SettingLabel title="Weekly page goal" description="Pages a week to keep your reading streak" />
      <Segmented options={OPTIONS} value={weeklyPages} onChange={setWeeklyPages} columns={5} />
    </>
  );
}
