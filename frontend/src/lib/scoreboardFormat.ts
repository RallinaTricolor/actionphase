import type {
  ScoreboardCell,
  ScoreboardDisplay,
  ScoreboardSortDescription,
} from '@/types/scoreboard';
import { SCOREBOARD_SORT_BY_NAME } from './scoreboardEditing';

/** What a blank cell shows: the character has no such entry, or no range fits. */
export const BLANK_SCOREBOARD_CELL = '—';

/**
 * The number a ranged cell shows after its label, or nothing when the viewer may
 * not see it: the server leaves `value` out for players.
 */
export function formatScoreboardBandValue(value: number | undefined): string {
  return value === undefined ? '' : `(${value})`;
}

/** A cell as text. */
export function formatScoreboardCell(cell: ScoreboardCell | undefined, display: ScoreboardDisplay): string {
  if (!cell) return BLANK_SCOREBOARD_CELL;
  const { value, max, label } = cell;
  if (display === 'bands') {
    return [label, formatScoreboardBandValue(value)].filter(Boolean).join(' ') || BLANK_SCOREBOARD_CELL;
  }
  if (value === undefined) return BLANK_SCOREBOARD_CELL;
  return display === 'value_max' && max !== undefined ? `${value} / ${max}` : String(value);
}

// By key, not label: a column may be headed "Name" too.
function describeSortKey({ key, label, direction }: ScoreboardSortDescription): string {
  if (key === SCOREBOARD_SORT_BY_NAME) return `${label} (${direction === 'asc' ? 'A to Z' : 'Z to A'})`;
  return `${label} (${direction === 'asc' ? 'low to high' : 'high to low'})`;
}

/**
 * The board's order in words. An empty description means the order uses a column
 * this viewer can't see, so it says who ordered it and nothing about how.
 */
export function describeScoreboardSort(sort: readonly ScoreboardSortDescription[] | null): string {
  if (!sort?.length) return 'Ranked by the GM';
  return `Sorted by ${sort.map(describeSortKey).join(', then ')}`;
}

/** Said when this viewer gets only the board's first rows; absent when it's whole. */
export function describeScoreboardCut(topCount: number | undefined): string | undefined {
  return topCount ? `Showing the top ${topCount}` : undefined;
}
