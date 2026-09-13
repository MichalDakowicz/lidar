// public.user_settings is Radar's table and Lidar shares the row, because it is
// one account: `friends_visibility` is what private.can_view() reads, so the
// privacy switch has to mean the same thing in both apps or a shelf you closed
// in one would still be open in the other.
//
// Lidar therefore touches only the two columns that are genuinely shared
// preferences — visibility and theme — plus the two that are Lidar's own
// publish channel, `lidar_streak` and `lidar_streak_updated_at`. Every
// Radar-specific column (streak thresholds, watch-provider country,
// notification prefs) is left alone, and a sparse upsert of the keys below
// cannot clobber them.
//
// The publish channel exists because Lidar's reading streak cannot be derived
// by anybody else: it is pages per week against a threshold in device MMKV,
// measured from a reset epoch also in device MMKV. Neither number is in this
// database, so Pulsar reading `book_progress` directly was guessing at two at
// once. Lidar snapshots the answer instead, exactly as Radar does for its own.

export type ThemePref = 'dark' | 'light' | 'system';
export type FriendsVisibility = 'public' | 'friends' | 'noone';

export type UserSettings = {
  friendsVisibility: FriendsVisibility;
  theme: ThemePref;
  /** Published for Pulsar's cross-app strip. Lidar itself never reads it back. */
  lidarStreak: number;
  /** When the figure above was measured, so a reader can age out a stale one. */
  lidarStreakUpdatedAt: string | null;
};

export type UserSettingsRow = {
  friends_visibility: FriendsVisibility | null;
  theme: string | null;
  lidar_streak: number | null;
  lidar_streak_updated_at: string | null;
};

export const DEFAULT_SETTINGS: UserSettings = {
  friendsVisibility: 'friends',
  theme: 'dark',
  lidarStreak: 0,
  lidarStreakUpdatedAt: null,
};

export function normalizeSettings(row: UserSettingsRow): UserSettings {
  const visibility = row.friends_visibility;
  return {
    friendsVisibility: visibility === 'public' || visibility === 'noone' ? visibility : 'friends',
    theme: row.theme === 'light' || row.theme === 'system' ? row.theme : 'dark',
    lidarStreak: typeof row.lidar_streak === 'number' ? row.lidar_streak : 0,
    lidarStreakUpdatedAt: row.lidar_streak_updated_at ?? null,
  };
}

const TO_COLUMN: Record<keyof UserSettings, keyof UserSettingsRow> = {
  friendsVisibility: 'friends_visibility',
  theme: 'theme',
  lidarStreak: 'lidar_streak',
  lidarStreakUpdatedAt: 'lidar_streak_updated_at',
};

/** A patch, keyed by column. Unknown keys are dropped rather than sent. */
export function settingsToRow(patch: Partial<UserSettings>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    const column = TO_COLUMN[key as keyof UserSettings];
    if (column) row[column] = value;
  }
  return row;
}
