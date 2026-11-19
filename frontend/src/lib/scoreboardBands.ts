import type { ScoreboardBand, ScoreboardColumn } from '@/types/scoreboard';

/**
 * Range logic for the GM's editor: the "test a value" box and the overlap and
 * gap warnings. Players' labels are always worked out by the server
 * (`core.scoreboardBandLabel`); the matching here has to agree with it.
 */

/** A span of numbers. An absent end runs on forever. */
export interface ScoreboardBandRange {
  min?: number;
  minOpen: boolean;
  max?: number;
  maxOpen: boolean;
}

interface ScoreboardBandOverlap {
  /** Listed first, so it gets the values both ranges cover. */
  winner: string;
  loser: string;
}

export interface ScoreboardBandCheck {
  overlaps: ScoreboardBandOverlap[];
  gaps: ScoreboardBandRange[];
}

export function scoreboardBandMatches(band: ScoreboardBand, measure: number): boolean {
  if (band.min !== undefined && (measure < band.min || (band.min_strict && measure === band.min))) return false;
  if (band.max !== undefined && (measure > band.max || (band.max_strict && measure === band.max))) return false;
  return true;
}

/** A row still being filled in can't be saved, so it can't match anything yet. */
const isComplete = (band: ScoreboardBand) =>
  band.label.trim() !== '' && (band.min !== undefined || band.max !== undefined);

/**
 * The label a number gets: the first matching range, else the fallback, else
 * nothing. `measure` is in the column's own terms, so a percent column takes a
 * percentage.
 */
export function scoreboardBandLabel(
  column: Pick<ScoreboardColumn, 'bands' | 'fallback_label'>,
  measure: number,
): string {
  const match = column.bands?.filter(isComplete).find((band) => scoreboardBandMatches(band, measure));
  return (match?.label ?? column.fallback_label ?? '').trim();
}

const toRange = (band: ScoreboardBand): ScoreboardBandRange => ({
  min: band.min,
  minOpen: band.min !== undefined && !!band.min_strict,
  max: band.max,
  maxOpen: band.max !== undefined && !!band.max_strict,
});

function isEmptyRange({ min, minOpen, max, maxOpen }: ScoreboardBandRange): boolean {
  if (min === undefined || max === undefined) return false;
  return min > max || (min === max && (minOpen || maxOpen));
}

function rangesOverlap(a: ScoreboardBandRange, b: ScoreboardBandRange): boolean {
  const lowFromA = b.min === undefined || (a.min !== undefined && a.min > b.min);
  const highFromA = b.max === undefined || (a.max !== undefined && a.max < b.max);
  return !isEmptyRange({
    min: lowFromA ? a.min : b.min,
    minOpen: a.min === b.min ? a.minOpen || b.minOpen : lowFromA ? a.minOpen : b.minOpen,
    max: highFromA ? a.max : b.max,
    maxOpen: a.max === b.max ? a.maxOpen || b.maxOpen : highFromA ? a.maxOpen : b.maxOpen,
  });
}

function compareByLowEnd(a: ScoreboardBandRange, b: ScoreboardBandRange): number {
  if (a.min === undefined || b.min === undefined) return Number(b.min === undefined) - Number(a.min === undefined);
  return a.min - b.min || Number(a.minOpen) - Number(b.minOpen);
}

/** The numbers no range covers, lowest first. */
function findGaps(ranges: ScoreboardBandRange[]): ScoreboardBandRange[] {
  const sorted = [...ranges].sort(compareByLowEnd);
  const first = sorted[0];
  if (!first) return [];

  const gaps: ScoreboardBandRange[] = [];
  if (first.min !== undefined) gaps.push({ max: first.min, maxOpen: !first.minOpen, minOpen: false });

  let reach = first.max;
  let reachOpen = first.maxOpen;
  for (const range of sorted.slice(1)) {
    if (reach === undefined) return gaps;
    const { min } = range;
    if (min !== undefined && (reach < min || (reach === min && reachOpen && range.minOpen))) {
      gaps.push({ min: reach, minOpen: !reachOpen, max: min, maxOpen: !range.minOpen });
    }
    if (range.max === undefined) {
      reach = undefined;
    } else if (range.max > reach || (range.max === reach && reachOpen && !range.maxOpen)) {
      reach = range.max;
      reachOpen = range.maxOpen;
    }
  }
  if (reach !== undefined) gaps.push({ min: reach, minOpen: !reachOpen, maxOpen: false });
  return gaps;
}

/**
 * What the GM may want to know about a set of ranges. Neither is an error:
 * overlaps resolve by order, and a value in a gap shows the fallback or a blank.
 */
export function checkScoreboardBands(bands: readonly ScoreboardBand[]): ScoreboardBandCheck {
  const usable = bands
    .filter(isComplete)
    .map((band) => ({ label: band.label.trim(), range: toRange(band) }))
    .filter(({ range }) => !isEmptyRange(range));

  const overlaps: ScoreboardBandOverlap[] = [];
  usable.forEach((later, index) => {
    for (const earlier of usable.slice(0, index)) {
      if (rangesOverlap(earlier.range, later.range)) overlaps.push({ winner: earlier.label, loser: later.label });
    }
  });

  return { overlaps, gaps: findGaps(usable.map(({ range }) => range)) };
}

/** A range the way the editor's rows write it: `5 < HP ≤ 10`. */
export function formatScoreboardBandRange(range: ScoreboardBandRange, subject: string): string {
  const { min, minOpen, max, maxOpen } = range;
  const below = maxOpen ? '<' : '≤';
  if (min !== undefined && max !== undefined) {
    return min === max ? `${subject} = ${min}` : `${min} ${minOpen ? '<' : '≤'} ${subject} ${below} ${max}`;
  }
  if (min !== undefined) return `${subject} ${minOpen ? '>' : '≥'} ${min}`;
  return `${subject} ${below} ${max}`;
}
