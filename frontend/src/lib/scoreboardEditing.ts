import { generateKey } from '@/lib/sheetLayoutEditing';
import type { SheetLayout } from '@/types/characters';
import type {
  ScoreboardBand,
  ScoreboardColumn,
  ScoreboardConfig,
  ScoreboardSort,
} from '@/types/scoreboard';

/** The backend's limits (`core.MaxScoreboard*`), so the form stops where a save would fail. */
export const MAX_SCOREBOARD_COLUMNS = 10;
export const MAX_SCOREBOARD_BANDS = 10;
export const MAX_SCOREBOARD_LABEL_LENGTH = 24;
/** A range label as written, formatting included (core.MaxScoreboardBandLabelSourceLength). */
export const MAX_SCOREBOARD_BAND_LABEL_SOURCE_LENGTH = 120;
export const MAX_SCOREBOARD_ENTRY_LENGTH = 40;
/** Mirrors core.MaxScoreboardTopCount. */
export const MAX_SCOREBOARD_TOP_COUNT = 50;

export const SCOREBOARD_SORT_BY_NAME = 'name';

export type ScoreboardFieldType = 'number' | 'track';

export interface ScoreboardSourceField {
  key: string;
  label: string;
  type: ScoreboardFieldType;
}

/** A sheet tab with at least one field a column can read. */
export interface ScoreboardSourceTab {
  key: string;
  label: string;
  fields: ScoreboardSourceField[];
}

export type ScoreboardSource = Pick<ScoreboardColumn, 'tab_key' | 'entry' | 'field_key'>;

export function scoreboardSourceTabs(layout: SheetLayout): ScoreboardSourceTab[] {
  return layout.tabs.flatMap((tab) => {
    const fields = tab.fields.flatMap((field): ScoreboardSourceField[] =>
      field.type === 'number' || field.type === 'track'
        ? [{ key: field.key, label: field.label, type: field.type }]
        : []);
    return fields.length > 0 ? [{ key: tab.key, label: tab.label, fields }] : [];
  });
}

/** The sheet field a column reads. Nothing means its source is gone. */
export function findScoreboardSourceField(
  tabs: readonly ScoreboardSourceTab[],
  column: ScoreboardSource,
): ScoreboardSourceField | undefined {
  return tabs.find((tab) => tab.key === column.tab_key)?.fields.find((field) => field.key === column.field_key);
}

const defaultLabel = (entry: string) =>
  Array.from(entry.trim()).slice(0, MAX_SCOREBOARD_LABEL_LENGTH).join('').trim();

export function newScoreboardColumn(source: ScoreboardSource, takenIds: ReadonlySet<string>): ScoreboardColumn {
  return {
    id: generateKey('c_', takenIds),
    label: defaultLabel(source.entry),
    ...source,
    entry: source.entry.trim(),
  };
}

/**
 * Points a column at a new source. A number has no maximum, so whatever needed
 * one is dropped. A heading still matching the old entry follows the new one.
 */
export function withScoreboardSource(
  column: ScoreboardColumn,
  source: ScoreboardSource,
  fieldType: ScoreboardFieldType,
): ScoreboardColumn {
  const next: ScoreboardColumn = { ...column, ...source, entry: source.entry.trim() };
  if (column.label.trim() === column.entry.trim()) next.label = defaultLabel(source.entry);
  if (fieldType !== 'track') {
    if (next.display === 'value_max') delete next.display;
    if (next.band_basis === 'percent') delete next.band_basis;
  }
  return next;
}

/** Removes a column, and any sort key that read it. */
export function removeScoreboardColumn(config: ScoreboardConfig, columnId: string): ScoreboardConfig {
  return {
    ...config,
    columns: config.columns?.filter((column) => column.id !== columnId),
    sort: config.sort?.filter((key) => key.key !== columnId),
  };
}

const sourceKey = ({ tab_key, entry, field_key }: ScoreboardSource) =>
  `${tab_key}\u0000${entry.trim().toLowerCase()}\u0000${field_key}`;

/** Columns reading the same value as another. Allowed, but often a slip. */
export function duplicateScoreboardColumnIds(columns: readonly ScoreboardColumn[]): Set<string> {
  const counts = new Map<string, number>();
  for (const column of columns) counts.set(sourceKey(column), (counts.get(sourceKey(column)) ?? 0) + 1);
  return new Set(columns.filter((column) => counts.get(sourceKey(column))! > 1).map((column) => column.id));
}

function toStoredBand({ label, min, min_strict, max, max_strict }: ScoreboardBand): ScoreboardBand {
  return {
    label: label.trim(),
    ...(min !== undefined && { min, ...(min_strict && { min_strict }) }),
    ...(max !== undefined && { max, ...(max_strict && { max_strict }) }),
  };
}

function toStoredColumn(column: ScoreboardColumn): ScoreboardColumn {
  const stored: ScoreboardColumn = {
    id: column.id,
    label: column.label.trim(),
    tab_key: column.tab_key,
    entry: column.entry.trim(),
    field_key: column.field_key,
    ...(column.hidden && { hidden: true }),
  };
  if (column.display === 'value_max') return { ...stored, display: 'value_max' };
  if (column.display !== 'bands') return stored;

  const fallback = column.fallback_label?.trim();
  return {
    ...stored,
    display: 'bands',
    bands: (column.bands ?? []).map(toStoredBand),
    ...(column.band_basis === 'percent' && { band_basis: 'percent' as const }),
    ...(fallback && { fallback_label: fallback }),
  };
}

/** Why a "players see only the top" count can't be saved, if it can't. Absent means everyone. */
export function scoreboardTopCountError(count: number | undefined): string | undefined {
  if (count === undefined) return undefined;
  if (!Number.isInteger(count) || count < 1 || count > MAX_SCOREBOARD_TOP_COUNT) {
    return `Enter a whole number from 1 to ${MAX_SCOREBOARD_TOP_COUNT}`;
  }
  return undefined;
}

// Mirrors scoreboardLabelMarkup in backend/pkg/core/scoreboard_config.go. The
// two must agree, or the editor accepts a label the server refuses.
const SCOREBOARD_LABEL_MARKUP = /\[color:[a-z]+\]|\[\/color\]|[*_~`]/g;

/** A range label without its formatting: what the length limit counts. */
export function scoreboardLabelText(label: string): string {
  return label.replace(SCOREBOARD_LABEL_MARKUP, '');
}

/** Why a range label (or the label for no match) can't be saved, if it can't. */
export function scoreboardBandLabelError(label: string | undefined): string | undefined {
  const trimmed = label?.trim() ?? '';
  if (!trimmed) return undefined;
  const text = scoreboardLabelText(trimmed);
  if (!text.trim()) return 'Add some text, not just formatting';
  if (Array.from(text).length > MAX_SCOREBOARD_LABEL_LENGTH) {
    return `Keep it to ${MAX_SCOREBOARD_LABEL_LENGTH} characters, not counting formatting`;
  }
  return undefined;
}

/** Whether any range label in the setup would be refused. */
export function hasScoreboardBandLabelError(columns: readonly ScoreboardColumn[]): boolean {
  return columns.some((column) =>
    column.display === 'bands'
    && [column.fallback_label, ...(column.bands ?? []).map((band) => band.label)]
      .some((label) => scoreboardBandLabelError(label) !== undefined));
}

const isDefaultSort = (sort: readonly ScoreboardSort[]) =>
  sort.length === 0
  || (sort.length === 1 && sort[0].key === SCOREBOARD_SORT_BY_NAME && sort[0].direction === 'asc');

/**
 * The draft as it would be stored: trimmed, defaults left out, and without the
 * ranges of a column not showing them. The draft keeps those, so switching a
 * column's display away and back doesn't lose them.
 */
export function toScoreboardConfig(draft: ScoreboardConfig): ScoreboardConfig {
  const columns = draft.columns ?? [];
  const sort = draft.sort ?? [];
  return {
    ...(draft.visibility === 'public' && { visibility: 'public' as const }),
    ...(columns.length > 0 && { columns: columns.map(toStoredColumn) }),
    ...(!isDefaultSort(sort) && { sort: [...sort] }),
    ...(draft.top_count !== undefined && { top_count: draft.top_count }),
  };
}
