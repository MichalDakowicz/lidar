import { useRef } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { dateKey } from '@/lib/streak';

/**
 * Six months of reading, a square per day, weeks scrolling sideways with the
 * day labels pinned. Radar's calendar, with pages in each cell instead of a
 * count of completions.
 *
 * The fill is graded rather than one flat colour: a 20-page evening and a
 * 400-page Sunday are both "read something", but only one of them is why the
 * week cleared its goal, and a calendar that cannot show that is just a
 * presence grid.
 */

const WEEKS_TO_SHOW = 26;
const WEEK_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

type Day = { dateStr: string; day: number; pages: number; isToday: boolean; isFuture: boolean };
type Week = { label: string; days: Day[] };

function buildWeeks(daily: Record<string, number>, today: Date): Week[] {
  const todayStr = dateKey(today);
  const weeks: Week[] = [];

  for (let weekIndex = WEEKS_TO_SHOW; weekIndex >= 0; weekIndex--) {
    const target = new Date(today);
    target.setDate(target.getDate() - weekIndex * 7);

    const start = new Date(target);
    const dow = start.getDay();
    start.setDate(start.getDate() - (dow === 0 ? 6 : dow - 1));
    start.setHours(0, 0, 0, 0);

    // Only the week that contains the 1st is labelled, so the strip reads as a
    // run of months rather than 26 repeated captions.
    const label = start.getDate() <= 7 ? start.toLocaleDateString(undefined, { month: 'short' }) : '';
    const days: Day[] = [];

    for (let i = 0; i < 7; i++) {
      const date = new Date(start);
      date.setDate(date.getDate() + i);
      const dateStr = dateKey(date);
      days.push({
        dateStr,
        day: date.getDate(),
        pages: daily[dateStr] || 0,
        isToday: dateStr === todayStr,
        isFuture: date > today,
      });
    }
    weeks.push({ label, days });
  }
  return weeks;
}

/** Four bands, so a heavy day is visibly heavier without needing a legend. */
function fillFor(pages: number, dayTarget: number): string {
  if (pages === 0) return 'border-border/50 bg-secondary/30';
  if (pages < dayTarget * 0.5) return 'border-primary/30 bg-primary/10';
  if (pages < dayTarget) return 'border-primary/50 bg-primary/20';
  if (pages < dayTarget * 2) return 'border-primary/70 bg-primary/35';
  return 'border-primary bg-primary/55';
}

export function StreakCalendar({ daily, weeklyGoal }: { daily: Record<string, number>; weeklyGoal: number }) {
  const scrollRef = useRef<ScrollView>(null);
  const didInit = useRef(false);
  const weeks = buildWeeks(daily, new Date());
  const dayTarget = Math.max(1, Math.round(weeklyGoal / 7));

  return (
    <View className="flex-row gap-2">
      <View className="gap-1.5">
        <View className="h-4" />
        {WEEK_DAYS.map((day) => (
          <View key={day} className="h-10 items-end justify-center pr-1">
            <Text className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{day}</Text>
          </View>
        ))}
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ flexDirection: 'row', gap: 6 }}
        // Weeks run oldest to newest, so open scrolled to the most recent.
        onContentSizeChange={() => {
          if (didInit.current) return;
          didInit.current = true;
          scrollRef.current?.scrollToEnd({ animated: false });
        }}
      >
        {weeks.map((week) => (
          <View key={week.days[0].dateStr} className="gap-1.5">
            <View className="h-4 items-center justify-center">
              <Text className="text-[10px] font-semibold text-muted-foreground">{week.label}</Text>
            </View>
            {week.days.map((day) => (
              <View
                key={day.dateStr}
                accessibilityLabel={`${day.dateStr}: ${day.pages} pages`}
                className={`h-10 w-10 items-center justify-center rounded-md border ${
                  day.isFuture ? 'border-border/30 bg-secondary/20 opacity-30' : fillFor(day.pages, dayTarget)
                } ${day.isToday ? 'border-2 border-primary' : ''}`}
              >
                <Text className={`text-xs font-medium ${day.pages > 0 ? 'text-foreground' : 'text-muted-foreground'}`}>
                  {day.day}
                </Text>
                {day.pages > 0 && (
                  <Text className="text-[8px] font-bold text-primary" numberOfLines={1}>
                    {day.pages > 999 ? '999+' : day.pages}
                  </Text>
                )}
              </View>
            ))}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
