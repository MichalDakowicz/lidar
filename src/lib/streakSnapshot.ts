// When to push Lidar's reading streak up to user_settings.lidar_streak.
//
// Nobody else can compute this. The streak is pages per week against a
// threshold the user picks (store/readingGoal) measured from a reset epoch
// (store/streakEpoch) — both device-local MMKV, neither in the database. So
// Lidar snapshots the answer and Pulsar's cross-app strip reads it, the same
// arrangement Radar already has for its own streak.
//
// That makes freshness the whole contract. A streak only stays true while the
// app that owns it keeps looking: a phone that has not opened Lidar in a week
// would otherwise keep publishing last week's run as today's. The stamp is what
// lets a reader tell the difference, so it has to be re-sent even when the
// number itself has not moved.

/** Past this, a reader should treat the snapshot as unknown rather than as fact. */
export const SNAPSHOT_STALE_MS = 48 * 60 * 60 * 1000;

/** Re-send well inside the staleness window, so a reader never sees it lapse. */
export const SNAPSHOT_REFRESH_MS = 12 * 60 * 60 * 1000;

export type PublishedStreak = {
  lidarStreak: number;
  lidarStreakUpdatedAt: string | null;
};

/**
 * True when the published copy no longer matches, or has aged far enough to be
 * worth restamping. Deliberately not "on every app open": the write is a round
 * trip and a realtime invalidation, and a streak that has not moved and was
 * stamped an hour ago has nothing to say.
 */
export function shouldPublishStreak(
  streak: number,
  snapshot: PublishedStreak,
  now: number = Date.now(),
): boolean {
  if (streak !== snapshot.lidarStreak) return true;
  if (!snapshot.lidarStreakUpdatedAt) return true;
  const at = Date.parse(snapshot.lidarStreakUpdatedAt);
  // An unparseable or future-dated stamp is not evidence of anything; rewrite it.
  if (Number.isNaN(at) || at > now + 60_000) return true;
  return now - at >= SNAPSHOT_REFRESH_MS;
}
