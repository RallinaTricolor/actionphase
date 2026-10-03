import Papa from 'papaparse';
import type { CharacterSheetField } from '@/types/characters';
import type { LootTableContent } from '@/types/games';
import { TRACK_DISPLAY_MODES, type TrackValue } from './sheetEntries';

/**
 * CSV import and export for a loot table, read and written against the schema
 * of the tab the table rolls into.
 *
 * Values matter here because a server-side roll writes an entry verbatim: a
 * number imported as the string "3" would reach the sheet as a string. So
 * import coerces each column by its field's type, and export writes values in
 * a form import reads back.
 */

const LOOT_CSV_DELIMITER = ',';

/**
 * Entry keys the CSV deliberately does not round-trip.
 *
 * `equipped` is a retired key: old item rows still carry it, but nothing reads
 * or sets it. Letting the importer write it would revive a field with no UI,
 * and it round-trips wrongly besides: an exported `false` returns as the truthy
 * string "false".
 */
const EXCLUDED_KEYS = new Set(['equipped']);

const TRUE_WORDS = new Set(['true', 'yes', 'y', '1', 'x']);
const FALSE_WORDS = new Set(['false', 'no', 'n', '0']);

type Coerced = { value: unknown } | { error: string } | undefined;

/** Import/export help, naming the columns this table's tab has. */
export function lootCsvHelp(fields: readonly CharacterSheetField[]): string {
  const columns = fields.map((field) => field.label);
  // Leads with the delimiter because it is the one rule that is impossible to
  // guess and fails silently in most spreadsheet exports. Export-then-edit is
  // offered as the reliable path: it hands the GM a correctly shaped file.
  return (
    `Comma-separated (${LOOT_CSV_DELIMITER}) list. The first row must be ` +
    `column headers and must include "name"; each row after it is one item. ` +
    (columns.length > 0 ? `Optional columns: ${columns.join(', ')} (by name or key). ` : '') +
    `Numbers must be numbers, checkboxes yes or no, and tracks current/max (like 3/5). ` +
    `Descriptions support Markdown; wrap any value containing "${LOOT_CSV_DELIMITER}", ` +
    `a line break, or a double quote in double quotes. ` +
    `Importing replaces all current items. Easiest route: add one item, Export, ` +
    `then edit that file and re-import it.`
  );
}

/**
 * The column header each field exports under: its label, which is what a GM
 * recognises, or its key when the label would read back as something else (a
 * label shared with another field, one spelling "name", or one spelling a
 * leftover key the items also carry, such as a removed default field's).
 */
function exportHeaders(fields: readonly CharacterSheetField[], otherKeys: readonly string[]): Map<string, string> {
  const labelCounts = new Map<string, number>();
  for (const field of fields) {
    const label = field.label.trim().toLowerCase();
    labelCounts.set(label, (labelCounts.get(label) ?? 0) + 1);
  }
  const keys = new Set(fields.map((field) => field.key));
  const others = new Set(otherKeys.map((key) => key.toLowerCase()));
  return new Map(
    fields.map((field) => {
      const label = field.label.trim();
      const lower = label.toLowerCase();
      const ambiguous =
        labelCounts.get(lower) !== 1 || lower === 'name' || (keys.has(label) && label !== field.key) || others.has(lower);
      return [field.key, ambiguous ? field.key : label];
    }),
  );
}

/**
 * The entry key a column header names: `name`, a field key, or a field label
 * (case-insensitive). Anything else is kept under the header as written, the
 * same as data the schema doesn't know about anywhere else.
 *
 * A label only stands in for a field that has no column under its own key:
 * when both are present (an export keeps a field apart from a leftover key
 * spelling its label), the label-like header is that leftover key.
 */
function columnKey(fields: readonly CharacterSheetField[], header: string, keyedColumns: ReadonlySet<string>): string {
  const trimmed = header.trim();
  if (trimmed.toLowerCase() === 'name') return 'name';
  if (fields.some((field) => field.key === trimmed)) return trimmed;
  const byLabel = fields.filter((field) => field.label.trim().toLowerCase() === trimmed.toLowerCase());
  return byLabel.length === 1 && !keyedColumns.has(byLabel[0].key) ? byLabel[0].key : trimmed;
}

function parseTrack(raw: string): TrackValue | undefined {
  let candidate: Partial<Record<keyof TrackValue, unknown>>;
  if (raw.startsWith('{')) {
    try {
      candidate = JSON.parse(raw);
    } catch {
      return undefined;
    }
  } else {
    const [value, max, ...rest] = raw.split('/').map((part) => part.trim());
    if (rest.length > 0) return undefined;
    candidate = { value: value === '' ? undefined : Number(value), max: max === undefined ? undefined : Number(max) };
  }

  const isNumber = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
  if (candidate.value !== undefined && !isNumber(candidate.value)) return undefined;
  if (candidate.max !== undefined && !isNumber(candidate.max)) return undefined;
  if (candidate.value === undefined && candidate.max === undefined) return undefined;

  // The same rules the track input stores by: a display mode only with the
  // positive maximum it draws against, and never the default.
  const track: TrackValue = { value: candidate.value ?? 0 };
  const bounded = candidate.max !== undefined && candidate.max > 0;
  if (bounded) track.max = candidate.max as number;
  const display = TRACK_DISPLAY_MODES.find((mode) => mode === candidate.display);
  if (bounded && display && display !== 'number') track.display = display;
  return track;
}

/** One cell into the value to store, undefined to leave the key out. */
function coerce(field: CharacterSheetField | undefined, raw: string): Coerced {
  const value = raw.trim();
  if (value === '') return undefined;
  if (!field) return { value };

  switch (field.type) {
    case 'number': {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? { value: parsed } : { error: `must be a number, not "${value}"` };
    }
    case 'checkbox': {
      const lower = value.toLowerCase();
      if (TRUE_WORDS.has(lower)) return { value: true };
      // Unchecked is stored as absent, as the entry form stores it.
      if (FALSE_WORDS.has(lower)) return undefined;
      return { error: `must be yes or no, not "${value}"` };
    }
    case 'track': {
      const track = parseTrack(value);
      return track ? { value: track } : { error: `must be a number or current/max like 3/5, not "${value}"` };
    }
    case 'select': {
      // Matched case-insensitively to the option's own spelling. A value that
      // isn't an option is kept: the form keeps a stale option selectable too.
      const option = field.options?.find((o) => o.toLowerCase() === value.toLowerCase());
      return { value: option ?? value };
    }
    default:
      // text, markdown, and any type this client doesn't know: kept as text,
      // trimmed as the entry form trims it.
      return { value };
  }
}

/**
 * Parses an uploaded CSV into loot table contents, or a message the GM can act
 * on. Papaparse doesn't error on the common mistakes (a wrong delimiter makes
 * each line one column; a missing name header yields nameless rows), so each
 * is checked here rather than left for the server to reject by row number.
 */
export function parseLootTableCsv(
  csvText: string,
  fields: readonly CharacterSheetField[],
): { items: LootTableContent[] } | { error: string } {
  const parsed = Papa.parse<Record<string, string>>(csvText, {
    delimiter: LOOT_CSV_DELIMITER,
    header: true,
    // A trailing newline is normal in any editor-saved file, and without this it
    // parses as a final row of empty strings: a phantom nameless item.
    skipEmptyLines: true,
  });

  const headers = parsed.meta.fields ?? [];
  const keyedColumns = new Set(headers.map((header) => header.trim()).filter((header) => fields.some((field) => field.key === header)));
  const keys = headers.map((header) => columnKey(fields, header, keyedColumns));
  if (!keys.includes('name')) {
    return {
      error: `The CSV needs a "name" column. Columns must be separated by "${LOOT_CSV_DELIMITER}".`,
    };
  }

  // A row with more fields than headers means an unquoted value contained the
  // delimiter, overwhelmingly a description like "Sharp, very sharp". Papaparse
  // keeps the first part, so accepting the row would truncate the GM's text.
  const raggedRow = parsed.errors.find((e) => e.code === 'TooManyFields');
  if (raggedRow) {
    const rowLabel = typeof raggedRow.row === 'number' ? `Row ${raggedRow.row + 1}` : 'A row';
    return {
      error:
        `${rowLabel} has more values than there are columns. A value containing "${LOOT_CSV_DELIMITER}" ` +
        `must be wrapped in double quotes — for example: "Sharp${LOOT_CSV_DELIMITER} very sharp".`,
    };
  }

  const fieldsByKey = new Map(fields.map((field) => [field.key, field]));
  const rows = parsed.data.filter((row) => Object.values(row).some((v) => v?.trim()));
  const items: LootTableContent[] = [];

  for (const [index, row] of rows.entries()) {
    const entry: Record<string, unknown> = {};
    for (const [column, header] of headers.entries()) {
      const key = keys[column];
      // Never an id: every roll or pick gives the entry its own.
      if (EXCLUDED_KEYS.has(key) || key === 'id') continue;
      const raw = row[header] ?? '';
      if (key === 'name') {
        entry.name = raw.trim();
        continue;
      }
      const coerced = coerce(fieldsByKey.get(key), raw);
      if (coerced && 'error' in coerced) {
        return { error: `Row ${index + 1}: "${fieldsByKey.get(key)?.label ?? header}" ${coerced.error}.` };
      }
      if (coerced) entry[key] = coerced.value;
    }
    if (!entry.name) {
      return { error: `Row ${index + 1} has no name. Every item needs a value in the "name" column.` };
    }
    items.push({ id: 0, name: entry.name as string, data: JSON.stringify(entry) });
  }

  if (items.length === 0) {
    return { error: 'That file has no item rows.' };
  }
  return { items };
}

/** One stored value as a cell import reads back to the same value. */
function cell(field: CharacterSheetField | undefined, value: unknown): unknown {
  if (field?.type === 'checkbox') return value === true ? 'yes' : '';
  if (field?.type === 'track' && typeof value === 'object' && value !== null) {
    const track = value as TrackValue;
    // current/max reads back the same; a display mode needs the JSON form.
    return track.display ? JSON.stringify(track) : track.max !== undefined ? `${track.value}/${track.max}` : String(track.value);
  }
  return typeof value === 'object' && value !== null ? JSON.stringify(value) : value;
}

/**
 * A loot table's contents as CSV: `name`, then the tab's fields in schema
 * order, then any other keys the items carry, so export then import is
 * lossless.
 */
export function lootTableToCsv(contents: readonly LootTableContent[], fields: readonly CharacterSheetField[]): string {
  // Items are GM-authored JSON and can be malformed, so parse defensively.
  const entries = contents.map((content) => {
    try {
      const parsed = JSON.parse(content.data);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : { name: content.name };
    } catch {
      return { name: content.name };
    }
  });

  const present = new Set(entries.flatMap((entry) => Object.keys(entry)).filter((key) => !EXCLUDED_KEYS.has(key)));
  const schemaKeys = fields.map((field) => field.key).filter((key) => present.has(key));
  const otherKeys = [...present].filter((key) => key !== 'name' && key !== 'id' && !schemaKeys.includes(key));
  const keys = ['name', ...schemaKeys, ...otherKeys];

  const headers = exportHeaders(fields, otherKeys);
  const fieldsByKey = new Map(fields.map((field) => [field.key, field]));
  const columns = keys.map((key) => headers.get(key) ?? key);
  // Rows as arrays, not objects: every row gets every column, so no ragged
  // trailing row, and each value lands under its header.
  const rows = entries.map((entry) => keys.map((key) => cell(fieldsByKey.get(key), entry[key]) ?? ''));
  return Papa.unparse({ fields: columns, data: rows }, { delimiter: LOOT_CSV_DELIMITER });
}
