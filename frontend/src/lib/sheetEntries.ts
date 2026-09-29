/**
 * An entry as stored: whatever JSON object the tab's blob holds. Old rows can
 * lack an id (see ensureIds), and every other key is opaque until
 * normalizeEntry has read it.
 */
export type RawSheetEntry = { id?: string } & Record<string, unknown>;

/**
 * One entry on a configurable tab, after normalizeEntry.
 *
 * Only `id` and `name` are fixed. Every other key is a field value, keyed by
 * field key, and typed by the tab's schema rather than here: the schema is
 * GM-defined, so the same key can mean different things in different games.
 * Keys the schema does not know about are kept, so removing a field hides its
 * data rather than destroying it.
 */
export interface SheetEntry {
  id: string;
  name: string;
  [key: string]: unknown;
}

/** How a bounded track draws. 'track' is the bar. */
export type TrackDisplayMode = 'number' | 'track' | 'boxes';

/** A `track` field's stored value: "Stress 4 / 9", drawn as a bar or boxes. */
export interface TrackValue {
  value: number;
  /**
   * Upper bound. Absent means an unbounded count (money, XP), which renders as
   * a number: there is no sensible maximum for a purse.
   */
  max?: number;
  /** Only meaningful with `max`. Absent means 'number'. */
  display?: TrackDisplayMode;
}

/** What EntryForm hands back: the name, plus a value per edited field. */
export interface EntryEdit {
  name: string;
  /**
   * Keyed by field key. `undefined` means the field was cleared and its key
   * is removed from the entry. Fields not listed are left untouched.
   */
  values: Record<string, unknown>;
}

export const TRACK_DISPLAY_MODES: readonly TrackDisplayMode[] = ['number', 'track', 'boxes'];

/**
 * Reads a stored entry into the current shape.
 *
 * The single home for every legacy read-fallback. Each rename below happened
 * inside a JSON blob, where a read-side fallback covers every old row, archived
 * payload and rolled-back deploy with no migration. Writes always use the new
 * shape, so a legacy row is rewritten only when someone edits it.
 *
 * - `skills`: `level` → `rank`, stringified. (Was `skillRank`.)
 * - `numbers`: `type` → `name`, and a bare numeric
 *   `amount` with flat `max`/`display` lifts into a `track` value.
 *
 * The legacy keys are removed from the result, so an edited row stops carrying
 * both spellings. All of them are reserved field keys server-side, so no GM
 * field can be using them.
 */
export function normalizeEntry(tabKey: string, raw: RawSheetEntry & { id: string }): SheetEntry {
  const entry: SheetEntry = { ...raw, name: typeof raw.name === 'string' ? raw.name : '' };

  if (tabKey === 'skills') {
    const { level } = entry;
    delete entry.level;
    const hasRank = typeof entry.rank === 'string' && entry.rank !== '';
    if (!hasRank && level !== undefined && level !== null && level !== '') {
      entry.rank = String(level);
    }
  }

  if (tabKey === 'numbers') {
    if (!entry.name && typeof entry.type === 'string') entry.name = entry.type;
    delete entry.type;

    const { amount, max, display } = entry;
    if (typeof amount === 'number' || (amount === undefined && typeof max === 'number')) {
      const track: TrackValue = { value: typeof amount === 'number' ? amount : 0 };
      if (typeof max === 'number') track.max = max;
      const mode = TRACK_DISPLAY_MODES.find((m) => m === display);
      if (mode) {
        track.display = mode;
      }
      entry.amount = track;
      delete entry.max;
      delete entry.display;
    }
  }

  return entry;
}

/**
 * Applies a form's edit to an entry.
 *
 * Merges onto the entry rather than rebuilding it from the schema: keys the
 * form does not know about (a removed field, a field type this client does not
 * recognise) survive the save untouched.
 */
export function applyEntryEdit(entry: SheetEntry, edit: EntryEdit): SheetEntry {
  const next: SheetEntry = { ...entry, name: edit.name };
  for (const [key, value] of Object.entries(edit.values)) {
    if (value === undefined) {
      delete next[key];
    } else {
      next[key] = value;
    }
  }
  return next;
}

/** Builds a new entry from a form's edit, leaving out cleared fields. */
export function createEntry(id: string, edit: EntryEdit): SheetEntry {
  return applyEntryEdit({ id, name: edit.name }, edit);
}

/**
 * Whether a track draws as a bar or boxes rather than a bare number.
 *
 * `max` is what makes a track possible, so `display` alone is not enough: a
 * 'boxes' track with no maximum has no box count to draw. A non-positive max
 * is excluded for the same reason. Requires an explicit bar or boxes display
 * rather than merely excluding 'number', because absent means 'number' and
 * the write path never stores the literal.
 */
function isBoundedTrack(track: TrackValue): boolean {
  return track.max !== undefined && track.max > 0 && (track.display === 'track' || track.display === 'boxes');
}

/** How many boxes to draw before falling back to a bar. */
const MAX_RENDERED_BOXES = 20;

/**
 * Which visual a track gets: bare number, bar, or boxes. Boxes fall back to a
 * bar past MAX_RENDERED_BOXES: twenty is already a wide row on a phone.
 */
export function trackVisual(track: TrackValue): 'number' | 'bar' | 'boxes' {
  if (!isBoundedTrack(track)) return 'number';
  const max = track.max ?? 0;
  return track.display === 'boxes' && Number.isInteger(max) && max <= MAX_RENDERED_BOXES ? 'boxes' : 'bar';
}
