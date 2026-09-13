import { SNAPSHOT_REFRESH_MS, shouldPublishStreak, type PublishedStreak } from '@/lib/streakSnapshot';

const NOW = Date.parse('2026-09-13T20:00:00.000Z');

function published(patch: Partial<PublishedStreak> = {}): PublishedStreak {
  return { lidarStreak: 7, lidarStreakUpdatedAt: new Date(NOW - 60_000).toISOString(), ...patch };
}

describe('shouldPublishStreak', () => {
  it('stays quiet when the figure matches and was just stamped', () => {
    expect(shouldPublishStreak(7, published(), NOW)).toBe(false);
  });

  it('publishes when the streak has moved', () => {
    expect(shouldPublishStreak(8, published(), NOW)).toBe(true);
  });

  it('publishes a streak that has fallen to nothing', () => {
    // The case that matters most: a broken streak has to be retracted, not just
    // left standing because the app has nothing new to boast about.
    expect(shouldPublishStreak(0, published(), NOW)).toBe(true);
  });

  it('publishes when nothing has ever been stamped', () => {
    expect(shouldPublishStreak(7, published({ lidarStreakUpdatedAt: null }), NOW)).toBe(true);
  });

  it('restamps an unchanged streak once the stamp is old enough', () => {
    const old = new Date(NOW - SNAPSHOT_REFRESH_MS).toISOString();
    expect(shouldPublishStreak(7, published({ lidarStreakUpdatedAt: old }), NOW)).toBe(true);
  });

  it('leaves an unchanged streak alone just inside the window', () => {
    const recent = new Date(NOW - SNAPSHOT_REFRESH_MS + 60_000).toISOString();
    expect(shouldPublishStreak(7, published({ lidarStreakUpdatedAt: recent }), NOW)).toBe(false);
  });

  it('rewrites a stamp it cannot trust', () => {
    expect(shouldPublishStreak(7, published({ lidarStreakUpdatedAt: 'not a date' }), NOW)).toBe(true);
    const future = new Date(NOW + 6 * 60 * 60 * 1000).toISOString();
    expect(shouldPublishStreak(7, published({ lidarStreakUpdatedAt: future }), NOW)).toBe(true);
  });
});
