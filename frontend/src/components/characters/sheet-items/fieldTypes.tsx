import type { ReactNode } from 'react';
import { Badge, Checkbox, Input, Select } from '@/components/ui';
import { CommentEditor } from '@/components/messages/CommentEditor';
import { MarkdownPreview } from '@/components/common/markdown/MarkdownPreview';
import type { CharacterSheetField } from '@/types/characters';
import { TRACK_DISPLAY_MODES, type EntryEdit, type TrackDisplayMode, type TrackValue } from '@/lib/sheetEntries';
import { TrackDisplay } from './TrackDisplay';

/**
 * Where EntryCard lays a field out. Every tab uses the same order: meta line,
 * tracks, collapsible sections, badges.
 */
export type FieldGroup = 'meta' | 'track' | 'section' | 'badge';

interface FieldInputProps<D> {
  /** Unique per form instance: several editors can be open at once. */
  id: string;
  field: CharacterSheetField;
  value: D;
  onChange: (value: D) => void;
}

/**
 * Everything the generic entry stack knows about one field type.
 *
 * A form holds a *draft* per field (what the inputs hold, e.g. a number as the
 * string typed so far) and converts it to a stored value only on submit. The
 * card renders through the same conversion, so what a card shows is exactly
 * what saving the entry unchanged would keep.
 */
export interface FieldTypeSpec<D> {
  group: FieldGroup;
  /** A stored value, of any shape, into the input's draft. Tolerates junk. */
  toDraft: (stored: unknown) => D;
  /** A draft into the value to store. `undefined` means "leave the key out". */
  fromDraft: (draft: D) => unknown;
  Input: (props: FieldInputProps<D>) => ReactNode;
  /**
   * Renders a stored value for the card, or null when there is nothing to
   * show. For the meta group this is the value text beside the label.
   * `entryName` identifies the entry to assistive tech where a field's own
   * label would not: every Numbers entry has an "Amount" track.
   */
  render: (stored: unknown, field: CharacterSheetField, entryName: string) => ReactNode;
}

const trimmedOrUndefined = (draft: string) => draft.trim() || undefined;

const stringDraft = (stored: unknown): string =>
  typeof stored === 'string' ? stored : typeof stored === 'number' ? String(stored) : '';

const numberDraft = (stored: unknown): string =>
  typeof stored === 'number' && Number.isFinite(stored) ? String(stored) : typeof stored === 'string' ? stored : '';

const parseNumber = (draft: string): number | undefined => {
  if (draft.trim() === '') return undefined;
  const parsed = Number(draft);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const text: FieldTypeSpec<string> = {
  group: 'meta',
  toDraft: stringDraft,
  fromDraft: trimmedOrUndefined,
  Input: ({ id, field, value, onChange }) => (
    <Input id={id} label={field.label} type="text" value={value} onChange={(e) => onChange(e.target.value)} />
  ),
  render: (stored) => trimmedOrUndefined(stringDraft(stored)) ?? null,
};

const number: FieldTypeSpec<string> = {
  group: 'meta',
  toDraft: numberDraft,
  fromDraft: parseNumber,
  Input: ({ id, field, value, onChange }) => (
    <Input
      id={id}
      label={field.label}
      type="number"
      step="any"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
  render: (stored) => parseNumber(numberDraft(stored))?.toLocaleString() ?? null,
};

const markdown: FieldTypeSpec<string> = {
  group: 'section',
  toDraft: stringDraft,
  fromDraft: trimmedOrUndefined,
  Input: ({ id, field, value, onChange }) => (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-content-primary mb-2">
        {field.label} <span className="text-xs text-content-tertiary font-normal">(Markdown supported)</span>
      </label>
      <CommentEditor id={id} value={value} onChange={onChange} rows={2} showPreviewByDefault={false} />
    </div>
  ),
  render: (stored) => {
    const content = trimmedOrUndefined(stringDraft(stored));
    return content ? <MarkdownPreview content={content} /> : null;
  },
};

const select: FieldTypeSpec<string> = {
  group: 'badge',
  toDraft: stringDraft,
  fromDraft: trimmedOrUndefined,
  Input: ({ id, field, value, onChange }) => {
    const options = field.options ?? [];
    // A value the GM has since removed from the options stays selectable, so
    // opening and saving the entry does not silently clear it.
    const stale = value !== '' && !options.includes(value);
    return (
      <Select id={id} label={field.label} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">None</option>
        {stale && <option value={value}>{value}</option>}
        {options.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </Select>
    );
  },
  render: (stored) => {
    const value = trimmedOrUndefined(stringDraft(stored));
    return value ? <Badge variant="primary" size="sm">{value}</Badge> : null;
  },
};

const checkbox: FieldTypeSpec<boolean> = {
  group: 'badge',
  toDraft: (stored) => stored === true,
  // Unchecked is stored as absent: "not set" and "false" read the same.
  fromDraft: (draft) => (draft ? true : undefined),
  Input: ({ id, field, value, onChange }) => (
    <Checkbox id={id} label={field.label} checked={value} onChange={(e) => onChange(e.target.checked)} />
  ),
  render: (stored, field) => (stored === true ? <Badge variant="neutral" size="sm">{field.label}</Badge> : null),
};

interface TrackDraft {
  value: string;
  max: string;
  display: TrackDisplayMode;
}

const trackToDraft = (stored: unknown): TrackDraft => {
  const track = (typeof stored === 'object' && stored !== null ? stored : {}) as Partial<Record<keyof TrackValue, unknown>>;
  const display = TRACK_DISPLAY_MODES.find((d) => d === track.display) ?? 'number';
  return { value: numberDraft(track.value), max: numberDraft(track.max), display };
};

const trackFromDraft = (draft: TrackDraft): TrackValue | undefined => {
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

const track: FieldTypeSpec<TrackDraft> = {
  group: 'track',
  toDraft: trackToDraft,
  fromDraft: trackFromDraft,
  Input: ({ id, field, value, onChange }) => {
    const max = parseNumber(value.max);
    return (
      <fieldset className="space-y-3">
        <legend className="text-sm font-medium text-content-primary mb-2">{field.label}</legend>
        <div className="flex gap-3">
          <Input
            id={`${id}-value`}
            label="Current"
            type="number"
            step="any"
            placeholder="0"
            value={value.value}
            onChange={(e) => onChange({ ...value, value: e.target.value })}
            className="flex-1"
          />
          <Input
            id={`${id}-max`}
            label="Maximum"
            type="number"
            step="any"
            min={0}
            placeholder="Optional"
            value={value.max}
            onChange={(e) => onChange({ ...value, max: e.target.value })}
            className="flex-1"
          />
        </div>
        {/* Hidden until there is a maximum: display is meaningless without one. */}
        {max !== undefined && max > 0 && (
          <Select
            id={`${id}-display`}
            label="Display as"
            value={value.display}
            onChange={(e) => onChange({ ...value, display: e.target.value as TrackDisplayMode })}
          >
            <option value="number">Number (4 / 9)</option>
            <option value="track">Bar</option>
            <option value="boxes">Boxes</option>
          </Select>
        )}
      </fieldset>
    );
  },
  render: (stored, field, entryName) => {
    const value = trackFromDraft(trackToDraft(stored));
    return value ? <TrackDisplay label={field.label} entryName={entryName} track={value} /> : null;
  },
};

/**
 * The field types, by the `type` a schema names.
 *
 * Widened to `unknown` drafts for lookup by string: each spec is internally
 * consistent, and callers only ever pass a spec's own drafts back to it.
 */
const FIELD_TYPES: Record<string, FieldTypeSpec<unknown>> = {
  text, number, markdown, select, checkbox, track,
} as Record<string, FieldTypeSpec<unknown>>;

/**
 * The spec for a field, or undefined for a type this client does not know (a
 * newer server). Callers skip such fields; their stored values are preserved
 * because edits merge onto the entry.
 */
export function fieldTypeOf(field: CharacterSheetField): FieldTypeSpec<unknown> | undefined {
  return Object.hasOwn(FIELD_TYPES, field.type) ? FIELD_TYPES[field.type] : undefined;
}

/**
 * Reads a loot table entry into an edit against a tab's schema.
 *
 * Loot data is GM-authored JSON, typed in the loot editor or imported from a
 * CSV, where every value arrives as a string. Known fields go through their
 * type's own draft conversion, so "3" in a number column is stored as 3, the
 * same as if the GM had typed it into the form. Keys the schema does not know
 * are carried over as they are, matching a server-side roll, which writes the
 * data verbatim.
 */
export function lootDataToEdit(
  fields: readonly CharacterSheetField[],
  name: string,
  data: Record<string, unknown>,
): EntryEdit {
  const values: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (key !== 'id' && key !== 'name') values[key] = value;
  }
  for (const field of fields) {
    const spec = fieldTypeOf(field);
    if (spec && Object.hasOwn(values, field.key)) {
      values[field.key] = spec.fromDraft(spec.toDraft(values[field.key]));
    }
  }
  return { name, values };
}
