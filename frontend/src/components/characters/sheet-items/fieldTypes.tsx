import type { ReactNode } from 'react';
import { Badge, Checkbox, Input, Select } from '@/components/ui';
import { CommentEditor } from '@/components/messages/CommentEditor';
import { MarkdownPreview } from '@/components/common/markdown/MarkdownPreview';
import type { CharacterSheetField } from '@/types/characters';
import type { TrackDisplayMode } from '@/lib/sheetEntries';
import {
  FIELD_CODECS,
  numberDraft,
  parseNumber,
  stringDraft,
  trackFromDraft,
  trackToDraft,
  trimmedOrUndefined,
  type FieldCodec,
  type TrackDraft,
} from '@/lib/sheetFieldValues';
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
 * what saving the entry unchanged would keep. The conversion is the type's
 * codec (`lib/sheetFieldValues.ts`), shared with every other sheet writer.
 */
export interface FieldTypeSpec<D> extends FieldCodec<D> {
  group: FieldGroup;
  Input: (props: FieldInputProps<D>) => ReactNode;
  /**
   * Renders a stored value for the card, or null when there is nothing to
   * show. For the meta group this is the value text beside the label.
   * `entryName` identifies the entry to assistive tech where a field's own
   * label would not: every Numbers entry has an "Amount" track.
   */
  render: (stored: unknown, field: CharacterSheetField, entryName: string) => ReactNode;
}

const text: FieldTypeSpec<string> = {
  ...FIELD_CODECS.text,
  group: 'meta',
  Input: ({ id, field, value, onChange }) => (
    <Input id={id} label={field.label} type="text" value={value} onChange={(e) => onChange(e.target.value)} />
  ),
  render: (stored) => trimmedOrUndefined(stringDraft(stored)) ?? null,
};

const number: FieldTypeSpec<string> = {
  ...FIELD_CODECS.number,
  group: 'meta',
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
  ...FIELD_CODECS.markdown,
  group: 'section',
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
  ...FIELD_CODECS.select,
  group: 'badge',
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
  ...FIELD_CODECS.checkbox,
  group: 'badge',
  Input: ({ id, field, value, onChange }) => (
    <Checkbox id={id} label={field.label} checked={value} onChange={(e) => onChange(e.target.checked)} />
  ),
  render: (stored, field) => (stored === true ? <Badge variant="neutral" size="sm">{field.label}</Badge> : null),
};

const track: FieldTypeSpec<TrackDraft> = {
  ...FIELD_CODECS.track,
  group: 'track',
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
