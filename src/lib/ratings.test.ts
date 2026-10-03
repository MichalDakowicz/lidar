import { personalScore } from './personalScore';
import {
  EMPTY_FACETS,
  FACETS_BY_KIND,
  isEmptyRatings,
  kindOfRatings,
  recalcOverall,
  toFacetValues,
  toRatingsPayload,
} from './ratings';

describe('personalScore', () => {
  it('prefers an explicit overall', () => {
    expect(personalScore({ overall: 4.2, prose: 5 })).toBe(4.2);
  });

  it('averages the facets that were answered', () => {
    expect(personalScore({ prose: 4, plot: 5 })).toBe(4.5);
  });

  it('ignores unanswered facets rather than counting them as zero', () => {
    expect(personalScore({ prose: 4, plot: 0 })).toBe(4);
  });

  it('averages the true-account facets too', () => {
    expect(personalScore({ prose: 4, insight: 5, impact: 4.5 })).toBe(4.5);
  });

  it('is null when nothing is scored', () => {
    expect(personalScore({})).toBeNull();
    expect(personalScore(null)).toBeNull();
    expect(personalScore({ overall: 0 })).toBeNull();
  });
});

describe('FACETS_BY_KIND', () => {
  it('shares prose and nothing else between the two sets', () => {
    const story = FACETS_BY_KIND.story.map((f) => f.key);
    const real = FACETS_BY_KIND.true.map((f) => f.key);
    expect(story.filter((key) => real.includes(key))).toEqual(['prose']);
  });

  it('asks nothing about plot or characters of a true account', () => {
    const real = FACETS_BY_KIND.true.map((f) => f.key);
    expect(real).not.toContain('plot');
    expect(real).not.toContain('characters');
  });
});

describe('recalcOverall', () => {
  it('rounds the facet average to one decimal', () => {
    expect(recalcOverall({ ...EMPTY_FACETS, prose: 4, plot: 5, characters: 4 }, 'story')).toBe(4.3);
  });

  it('is null on an untouched form, so "average" cannot stamp a 0.0', () => {
    expect(recalcOverall(EMPTY_FACETS, 'story')).toBeNull();
    expect(recalcOverall(EMPTY_FACETS, 'true')).toBeNull();
  });

  it('averages only the active set, even when the draft still holds the other', () => {
    const facets = { ...EMPTY_FACETS, prose: 4, plot: 1, insight: 5 };
    expect(recalcOverall(facets, 'true')).toBe(4.5);
    expect(recalcOverall(facets, 'story')).toBe(2.5);
  });
});

describe('toRatingsPayload', () => {
  it('drops unanswered facets instead of storing zeroes', () => {
    expect(toRatingsPayload({ ...EMPTY_FACETS, prose: 4, replay: 3 }, 3.5, 'story')).toEqual({
      prose: 4,
      replay: 3,
      overall: 3.5,
    });
  });

  it('omits the overall when it was never set', () => {
    expect(toRatingsPayload({ ...EMPTY_FACETS, prose: 4 }, 0, 'story')).toEqual({ prose: 4 });
  });

  it('keeps only the active set, so flipping a book drops the questions that no longer apply', () => {
    const facets = { ...EMPTY_FACETS, prose: 4, plot: 3, insight: 5, credibility: 4 };
    expect(toRatingsPayload(facets, 0, 'true')).toEqual({ prose: 4, insight: 5, credibility: 4 });
    expect(toRatingsPayload(facets, 0, 'story')).toEqual({ prose: 4, plot: 3 });
  });

  it('round-trips through toFacetValues', () => {
    const payload = toRatingsPayload({ ...EMPTY_FACETS, prose: 4, plot: 3.5 }, 0, 'story');
    expect(toFacetValues(payload)).toEqual({ ...EMPTY_FACETS, prose: 4, plot: 3.5 });
  });
});

describe('kindOfRatings', () => {
  it('reads a true account off its own facets', () => {
    expect(kindOfRatings({ prose: 4, impact: 5 })).toBe('true');
  });

  it('reads a story off plot, characters or re-read, which every rating before this one used', () => {
    expect(kindOfRatings({ plot: 4 })).toBe('story');
    expect(kindOfRatings({ characters: 3, overall: 3 })).toBe('story');
    expect(kindOfRatings({ replay: 2 })).toBe('story');
  });

  it('cannot tell from prose and an overall alone, which fit both sets', () => {
    expect(kindOfRatings({ prose: 4, overall: 4 })).toBeNull();
    expect(kindOfRatings({})).toBeNull();
    expect(kindOfRatings(null)).toBeNull();
  });
});

describe('isEmptyRatings', () => {
  it('recognises an emptied form, which is what deletes the row', () => {
    expect(isEmptyRatings({})).toBe(true);
    expect(isEmptyRatings({ overall: 0 })).toBe(true);
    expect(isEmptyRatings({ replay: 1 })).toBe(false);
    expect(isEmptyRatings({ credibility: 1 })).toBe(false);
  });
});
