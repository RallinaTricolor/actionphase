import { describe, expect, it } from 'vitest';
import { BLANK_SCOREBOARD_CELL, describeScoreboardCut, describeScoreboardSort, formatScoreboardCell } from './scoreboardFormat';

describe('formatScoreboardCell', () => {
  it.each([
    ['a number', { value: 7 }, 'value', '7'],
    ['zero, which is a real score', { value: 0 }, 'value', '0'],
    ['a fraction', { value: 1.5 }, 'value', '1.5'],
    ['value of max', { value: 7, max: 12 }, 'value_max', '7 / 12'],
    ['value of max when the track has no max', { value: 7 }, 'value_max', '7'],
    ['a range label for a player', { label: 'Bloodied' }, 'bands', 'Bloodied'],
    ['a range label with its number for the GM', { value: 7, max: 12, label: 'Bloodied' }, 'bands', 'Bloodied (7)'],
    ['a number that fits no range, for the GM', { value: 7 }, 'bands', '(7)'],
  ] as const)('reads %s', (_name, cell, display, expected) => {
    expect(formatScoreboardCell(cell, display)).toBe(expected);
  });

  it.each(['value', 'value_max', 'bands'] as const)('shows a blank %s cell as a dash', (display) => {
    expect(formatScoreboardCell(undefined, display)).toBe(BLANK_SCOREBOARD_CELL);
    expect(formatScoreboardCell({}, display)).toBe(BLANK_SCOREBOARD_CELL);
  });
});

describe('describeScoreboardSort', () => {
  it('names each key in order', () => {
    expect(describeScoreboardSort([
      { key: 'c_score1', label: 'Score', direction: 'desc' },
      { key: 'name', label: 'Name', direction: 'asc' },
    ])).toBe('Sorted by Score (high to low), then Name (A to Z)');
  });

  it('reads the other direction', () => {
    expect(describeScoreboardSort([
      { key: 'c_wound1', label: 'Wounds', direction: 'asc' },
      { key: 'name', label: 'Name', direction: 'desc' },
    ])).toBe('Sorted by Wounds (low to high), then Name (Z to A)');
  });

  it('reads a column headed Name as a number, not as the name sort', () => {
    expect(describeScoreboardSort([
      { key: 'c_named1', label: 'Name', direction: 'desc' },
    ])).toBe('Sorted by Name (high to low)');
  });

  it.each([[[]], [null]])('says only that the GM ranked it when the sort is withheld (%j)', (sort) => {
    expect(describeScoreboardSort(sort)).toBe('Ranked by the GM');
  });
});

describe('describeScoreboardCut', () => {
  it('says how many rows a cut board shows, and nothing for a whole one', () => {
    expect(describeScoreboardCut(3)).toBe('Showing the top 3');
    expect(describeScoreboardCut(undefined)).toBeUndefined();
  });
});
