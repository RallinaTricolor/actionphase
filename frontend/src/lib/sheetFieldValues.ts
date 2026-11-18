/**
 * How each sheet field type stores its value: the one conversion every writer
 * of character sheet entries goes through.
 *
 * The sheet editor (`EntryForm`, `EntryCard`, loot tables) and the results
 * board's sheet changes (`lib/gmBoard/rewards.ts`) both store values through
 * these codecs, so an entry either one writes is exactly what the other would
 * write. That matters because an entry the editor would store differently is
 * rewritten the next time someone opens it and saves: a value in a shape the
 * editor can't read (a track stored as a bare number, say) is read as empty
 * and erased.
 *
 * A codec turns a stored value of any shape into the editor's *draft* (what
 * its inputs hold, e.g. a number as the string typed so far), and a draft
 * back into the value to store. `undefined` from `fromDraft` means "leave the
 * key out".
 */

import type { CharacterSheetField } from '@/types/characters';
import { applyEntryEdit, TRACK_DISPLAY_MODES, type EntryEdit, type SheetEntry, type TrackDisplayMode, type TrackValue } from './sheetEntries';

export interface FieldCodec<D> {
  /** A stored value, of any shape, into the input's draft. Tolerates junk. */
  toDraft: (stored: unknown) => D;
  /** A draft into the value to store. `undefined` means "leave the key out". */
  fromDraft: (draft: D) => unknown;
}

export const trimmedOrUndefined = (draft: string) => draft.trim() || undefined;

export const stringDraft = (stored: unknown): string =>
  typeof stored === 'string' ? stored : typeof stored === 'number' ? String(stored) : '';

export const numberDraft = (stored: unknown): string =>
  typeof stored === 'number' && Number.isFinite(stored) ? String(stored) : typeof stored === 'string' ? stored : '';

export const parseNumber = (draft: string): number | undefined => {
  if (draft.trim() === '') return undefined;
  const parsed = Number(draft);
  return Number.isFinite(parsed) ? parsed : undefined;
};

export interface TrackDraft {
  value: string;
  max: string;
  display: TrackDisplayMode;
}

export const trackToDraft = (stored: unknown): TrackDraft => {
  const track = (typeof stored === 'object' && stored !== null ? stored : {}) as Partial<Record<keyof TrackValue, unknown>>;
  const display = TRACK_DISPLAY_MODES.find((d) => d === track.display) ?? 'number';
  return { value: numberDraft(track.value), max: numberDraft(track.max), display };
};

export const trackFromDraft = (draft: TrackDraft): TrackValue | undefined => {
  const value = parseNumber(draft.value);
  const max = parseNumber(draft.max);
  // A maximum is what makes a track possible; without a positive one there is
  // nothing to draw against.
  const bounded = max !== undefined && max > 0;
  if (value === undefined && !bounded) return undefined;

  const track: TrackValue = { value: value ?? 0 };
  if (bounded) track.max = max;
  // Never persist a display mode without the max it renders against, and
  // never persist the default: 'number' is what an absent key already means.
  if (bounded && draft.display !== 'number') track.display = draft.display;
  return track;
};

const textCodec: FieldCodec<string> = { toDraft: stringDraft, fromDraft: trimmedOrUndefined };

/** The codecs, by the `type` a schema names. */
export const FIELD_CODECS = {
  text: textCodec,
  number: { toDraft: numberDraft, fromDraft: parseNumber } as FieldCodec<string>,
  markdown: textCodec,
  select: textCodec,
  checkbox: {
    toDraft: (stored: unknown) => stored === true,
    // Unchecked is stored as absent: "not set" and "false" read the same.
    fromDraft: (draft: boolean) => (draft ? true : undefined),
  } as FieldCodec<boolean>,
  track: { toDraft: trackToDraft, fromDraft: trackFromDraft } as FieldCodec<TrackDraft>,
};

/**
 * The codec for a field, or undefined for a type this client does not know (a
 * newer server). Writers leave such fields alone.
 */
export function fieldCodecOf(field: CharacterSheetField): FieldCodec<unknown> | undefined {
  return Object.hasOwn(FIELD_CODECS, field.type) ? (FIELD_CODECS as Record<string, FieldCodec<unknown>>)[field.type] : undefined;
}

/** A stored value as the editor would store it after opening and saving it unchanged. */
export function canonicalValue(field: CharacterSheetField, stored: unknown): unknown {
  const codec = fieldCodecOf(field);
  return codec ? codec.fromDraft(codec.toDraft(stored)) : stored;
}

/**
 * An entry as the sheet editor would store it after opening it and saving it
 * unchanged. A writer's entry must equal this, or the editor would change it,
 * and possibly erase part of it, the next time anyone saves it.
 */
export function canonicalEntry(fields: readonly CharacterSheetField[], entry: SheetEntry): SheetEntry {
  const values: Record<string, unknown> = {};
  for (const field of fields) {
    if (fieldCodecOf(field)) values[field.key] = canonicalValue(field, entry[field.key]);
  }
  return applyEntryEdit(entry, { name: entry.name.trim(), values });
}

/**
 * Reads a loot table entry into an edit against a tab's schema.
 *
 * Loot data is GM-authored JSON, typed in the loot editor or imported from a
 * CSV, where every value arrives as a string. Known fields go through their
 * type's own conversion, so "3" in a number column is stored as 3, the same as
 * if the GM had typed it into the form. Keys the schema does not know are
 * carried over as they are, matching a server-side roll, which writes the data
 * verbatim.
 */
export function lootDataToEdit(fields: readonly CharacterSheetField[], name: string, data: Record<string, unknown>): EntryEdit {
  const values: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (key !== 'id' && key !== 'name') values[key] = value;
  }
  for (const field of fields) {
    if (fieldCodecOf(field) && Object.hasOwn(values, field.key)) {
      values[field.key] = canonicalValue(field, values[field.key]);
    }
  }
  return { name, values };
}
