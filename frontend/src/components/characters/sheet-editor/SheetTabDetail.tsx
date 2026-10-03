import { useId, useMemo, useState } from 'react';
import { Badge, Button, Card, CardBody, CardHeader, Input } from '@/components/ui';
import type { CharacterSheetField, SheetTab } from '@/types/characters';
import { DEFAULT_SHEET_LAYOUT } from '@/hooks/useSheetLayout';
import {
  SHEET_LIMITS,
  charactersWithFieldData,
  fieldRemovalMessage,
  missingDefaultFields,
  newField,
  sampleEntry,
  type CastSheetData,
  type LayoutProblem,
  type SheetFieldType,
} from '@/lib/sheetLayoutEditing';
import { EntryCard } from '../sheet-items/EntryCard';
import { SheetFieldRow } from './SheetFieldRow';
import { AddSheetFieldForm } from './AddSheetFieldForm';

interface SheetTabDetailProps {
  tab: SheetTab;
  /** Problems anywhere in this tab, from layoutProblems. */
  problems: LayoutProblem[];
  /** Every character's sheet rows, to count what a removal would hide. Undefined while loading. */
  cast: CastSheetData | undefined;
  onChange: (tab: SheetTab) => void;
}

const noop = () => {};

function move<T>(list: readonly T[], index: number, direction: -1 | 1): T[] {
  const next = [...list];
  [next[index], next[index + direction]] = [next[index + direction], next[index]];
  return next;
}

/** One tab in the editor: its name, its fields, and a preview of an entry. */
export function SheetTabDetail({ tab, problems, cast, onChange }: SheetTabDetailProps) {
  const id = useId();
  const [adding, setAdding] = useState(false);
  const defaultLabel = DEFAULT_SHEET_LAYOUT.find((t) => t.key === tab.key)?.label;
  const defaultFieldKeys = useMemo(
    () => new Set(DEFAULT_SHEET_LAYOUT.find((t) => t.key === tab.key)?.fields.map((f) => f.key)),
    [tab.key],
  );
  const restorable = missingDefaultFields(tab);
  const atFieldLimit = tab.fields.length >= SHEET_LIMITS.fieldsPerTab;
  const tabProblems = problems.filter((p) => !p.fieldKey).map((p) => p.message);
  const preview = useMemo(() => sampleEntry(tab.fields), [tab.fields]);

  const setFields = (fields: CharacterSheetField[]) => onChange({ ...tab, fields });
  const replaceField = (index: number, field: CharacterSheetField) =>
    setFields(tab.fields.map((f, i) => (i === index ? field : f)));

  const addField = (label: string, type: SheetFieldType, options: string[]) => {
    setFields([...tab.fields, newField(label, type, options, new Set(tab.fields.map((f) => f.key)))]);
    setAdding(false);
  };

  const removalMessageFor = (field: CharacterSheetField): string | null => {
    const count = cast ? charactersWithFieldData(cast, tab.key, field.key) : undefined;
    // Nothing stored under this key: removing it hides nothing, so no prompt.
    if (count === 0) return null;
    return fieldRemovalMessage(count, tab.isBuiltIn && defaultFieldKeys.has(field.key));
  };

  return (
    <div className="space-y-6" data-testid="sheet-tab-detail">
      <Input
        id={`${id}-tab-name`}
        label="Tab name"
        value={tab.label}
        onChange={(e) => onChange({ ...tab, label: e.target.value })}
        placeholder={defaultLabel}
        helperText={defaultLabel ? `Leave blank to use the default name, ${defaultLabel}.` : undefined}
      />
      {tabProblems.length > 0 && (
        <ul className="text-sm text-semantic-danger space-y-1 -mt-4">
          {tabProblems.map((problem) => <li key={problem}>{problem}</li>)}
        </ul>
      )}

      <section aria-labelledby={`${id}-fields`} className="space-y-3">
        <h3 id={`${id}-fields`} className="text-base font-semibold text-content-primary">Fields</h3>
        <ul className="space-y-3">
          <li className="rounded-lg border border-theme-default surface-sunken p-3 flex items-center justify-between gap-2">
            <span className="text-sm text-content-primary font-medium">Name</span>
            <span className="text-xs text-content-tertiary">Every entry has one</span>
          </li>
          {tab.fields.map((field, index) => (
            <SheetFieldRow
              key={field.key}
              field={field}
              problems={problems.filter((p) => p.fieldKey === field.key).map((p) => p.message)}
              canMoveUp={index > 0}
              canMoveDown={index < tab.fields.length - 1}
              onChange={(next) => replaceField(index, next)}
              onMove={(direction) => setFields(move(tab.fields, index, direction))}
              onRemove={() => setFields(tab.fields.filter((_, i) => i !== index))}
              removalMessage={removalMessageFor(field)}
            />
          ))}
        </ul>

        {adding ? (
          <AddSheetFieldForm onAdd={addField} onCancel={() => setAdding(false)} />
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => setAdding(true)} disabled={atFieldLimit}>
              Add field
            </Button>
            {atFieldLimit && (
              <span className="text-xs text-content-tertiary">A tab can have at most {SHEET_LIMITS.fieldsPerTab} fields.</span>
            )}
          </div>
        )}

        {restorable.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-content-secondary">Restore default field:</span>
            {restorable.map((field) => (
              <Button
                key={field.key}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setFields([...tab.fields, field])}
                disabled={atFieldLimit}
              >
                {field.label}
              </Button>
            ))}
          </div>
        )}
      </section>

      <Card variant="bordered" padding="sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-content-primary">Preview</h3>
            <Badge variant="neutral" size="sm">Sample values</Badge>
          </div>
        </CardHeader>
        <CardBody>
          <EntryCard entry={preview} fields={tab.fields} canEdit={false} onUpdate={noop} onRemove={noop} />
        </CardBody>
      </Card>
    </div>
  );
}
