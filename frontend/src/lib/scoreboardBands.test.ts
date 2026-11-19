import { describe, expect, it } from 'vitest';
import type { ScoreboardBand } from '@/types/scoreboard';
import {
  checkScoreboardBands,
  formatScoreboardBandRange,
  scoreboardBandLabel,
  scoreboardBandMatches,
} from './scoreboardBands';

// The same example the backend's tests use (core.hpBands).
const HP_BANDS: ScoreboardBand[] = [
  { label: 'Healthy', min: 10 },
  { label: 'Bloodied', min: 5, min_strict: true, max: 10, max_strict: true },
  { label: 'Critical', min: 0, min_strict: true, max: 5 },
  { label: 'Down', max: 0 },
];

describe('scoreboardBandLabel', () => {
  it.each([
    [12, 'Healthy'],
    [10, 'Healthy'],
    [7, 'Bloodied'],
    [5, 'Critical'],
    [1, 'Critical'],
    [0, 'Down'],
    [-3, 'Down'],
  ])('reads %d as %s, including exactly on a boundary', (value, label) => {
    expect(scoreboardBandLabel({ bands: HP_BANDS }, value)).toBe(label);
  });

  it('gives the first match when ranges overlap', () => {
    const bands = [{ label: 'First', min: 0 }, { label: 'Second', min: 5 }];
    expect(scoreboardBandLabel({ bands }, 7)).toBe('First');
  });

  it('falls back when nothing matches, and never to the number', () => {
    const bands = [{ label: 'High', min: 100 }];
    expect(scoreboardBandLabel({ bands, fallback_label: 'Unknown' }, 7)).toBe('Unknown');
    expect(scoreboardBandLabel({ bands }, 7)).toBe('');
  });

  it('skips rows still being filled in', () => {
    const bands = [{ label: '', min: 0 }, { label: 'No bounds' }, { label: 'Real', min: 0 }];
    expect(scoreboardBandLabel({ bands }, 3)).toBe('Real');
  });
});

describe('scoreboardBandMatches', () => {
  it('treats a strict bound as excluding the bound itself', () => {
    expect(scoreboardBandMatches({ label: 'x', min: 5, min_strict: true }, 5)).toBe(false);
    expect(scoreboardBandMatches({ label: 'x', min: 5 }, 5)).toBe(true);
    expect(scoreboardBandMatches({ label: 'x', max: 5, max_strict: true }, 5)).toBe(false);
    expect(scoreboardBandMatches({ label: 'x', max: 5 }, 5)).toBe(true);
  });
});

describe('checkScoreboardBands', () => {
  it('has nothing to say about ranges that fit together exactly', () => {
    expect(checkScoreboardBands(HP_BANDS)).toEqual({ overlaps: [], gaps: [] });
  });

  it('names overlapping ranges, the earlier one winning', () => {
    const { overlaps } = checkScoreboardBands([
      { label: 'Low', max: 5 },
      { label: 'High', min: 5 },
    ]);
    expect(overlaps).toEqual([{ winner: 'Low', loser: 'High' }]);
  });

  it('doesn’t count ranges that only touch at a bound one of them excludes', () => {
    const { overlaps } = checkScoreboardBands([
      { label: 'Low', max: 5, max_strict: true },
      { label: 'High', min: 5 },
    ]);
    expect(overlaps).toEqual([]);
  });

  it('finds the numbers on both sides and between ranges', () => {
    const { gaps } = checkScoreboardBands([
      { label: 'A', min: 0, max: 5 },
      { label: 'B', min: 8, max: 10, max_strict: true },
    ]);
    expect(gaps.map((gap) => formatScoreboardBandRange(gap, 'HP'))).toEqual([
      'HP < 0',
      '5 < HP < 8',
      'HP ≥ 10',
    ]);
  });

  it('finds the single number two strict bounds leave out', () => {
    const { gaps } = checkScoreboardBands([
      { label: 'Low', max: 5, max_strict: true },
      { label: 'High', min: 5, min_strict: true },
    ]);
    expect(gaps.map((gap) => formatScoreboardBandRange(gap, 'HP'))).toEqual(['HP = 5']);
  });

  it('sees past a range nested inside another', () => {
    const { gaps } = checkScoreboardBands([
      { label: 'Wide', min: 0, max: 10 },
      { label: 'Narrow', min: 2, max: 3 },
      { label: 'Rest', min: 10 },
    ]);
    expect(gaps.map((gap) => formatScoreboardBandRange(gap, 'HP'))).toEqual(['HP < 0']);
  });

  it('ignores unfinished rows and ranges that can never match', () => {
    expect(checkScoreboardBands([
      { label: '', min: 0 },
      { label: 'No bounds' },
      { label: 'Impossible', min: 9, max: 1 },
    ])).toEqual({ overlaps: [], gaps: [] });
  });
});

describe('formatScoreboardBandRange', () => {
  it.each([
    [{ min: 5, minOpen: true, max: 10, maxOpen: false }, '5 < HP ≤ 10'],
    [{ min: 5, minOpen: false, maxOpen: false }, 'HP ≥ 5'],
    [{ min: 5, minOpen: true, maxOpen: false }, 'HP > 5'],
    [{ minOpen: false, max: 5, maxOpen: true }, 'HP < 5'],
    [{ min: 5, minOpen: false, max: 5, maxOpen: false }, 'HP = 5'],
  ])('writes %j', (range, expected) => {
    expect(formatScoreboardBandRange(range, 'HP')).toBe(expected);
  });
});
