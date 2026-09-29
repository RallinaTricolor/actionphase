import { useId, useMemo, useState } from 'react';
import { Button, Input } from '@/components/ui';
import { useReportDirty } from '@/hooks/useReportDirty';
import type { CharacterSheetField } from '@/types/characters';
import type { EntryEdit, SheetEntry } from '@/lib/sheetEntries';
import { fieldTypeOf } from './fieldTypes';

interface EntryFormProps {
  /** The tab's schema. Fields of a type this client does not know are skipped. */
  fields: readonly CharacterSheetField[];
  /** The entry being edited; absent when adding a new one. */
  initialEntry?: SheetEntry;
  onSubmit: (edit: EntryEdit) => void;
  onCancel: () => void;
  submitLabel?: string;
  variant?: 'modal' | 'inline';
  submitButtonTestId?: string;
  /** Reports whether the form holds edits that Save has not yet committed. */
  onDirtyChange?: (isDirty: boolean) => void;
}

/**
 * The add/edit form for an entry on any configurable tab, built from the tab's
 * schema. Used by AddEntryModal and EntryCard's inline editor.
 *
 * Returns an EntryEdit rather than an entry: the caller merges it onto the
 * stored entry, so keys this form does not render survive the save.
 */
export const EntryForm: React.FC<EntryFormProps> = ({
  fields,
  initialEntry,
  onSubmit,
  onCancel,
  submitLabel = 'Add',
  variant = 'modal',
  submitButtonTestId,
  onDirtyChange,
}) => {
  const idPrefix = useId();
  const known = useMemo(
    () => fields.flatMap((field) => {
      const spec = fieldTypeOf(field);
      return spec ? [{ field, spec }] : [];
    }),
    [fields],
  );

  const initialDraft = (key: string) => {
    const entry = known.find((k) => k.field.key === key);
    return entry?.spec.toDraft(initialEntry?.[key]);
  };

  const [name, setName] = useState(initialEntry?.name ?? '');
  const [drafts, setDrafts] = useState<Record<string, unknown>>(() =>
    Object.fromEntries(known.map(({ field, spec }) => [field.key, spec.toDraft(initialEntry?.[field.key])]))
  );
  // A field the layout gained while this form was open has no draft yet.
  const draftOf = (key: string) => (key in drafts ? drafts[key] : initialDraft(key));

  const buildEdit = (): EntryEdit => ({
    name: name.trim(),
    values: Object.fromEntries(known.map(({ field, spec }) => [field.key, spec.fromDraft(draftOf(field.key))])),
  });

  // Dirty is judged on what Save would store, not on what the inputs hold, so
  // an edit Save would discard (trailing whitespace, "3" → "3.0") does not
  // report dirty. Otherwise the form soft-locks the sheet's tabs with nothing
  // left to commit.
  const baseline = useMemo(
    () => JSON.stringify([
      (initialEntry?.name ?? '').trim(),
      known.map(({ field, spec }) => spec.fromDraft(spec.toDraft(initialEntry?.[field.key]))),
    ]),
    [initialEntry, known],
  );
  const edit = buildEdit();
  useReportDirty(
    JSON.stringify([edit.name, known.map(({ field }) => edit.values[field.key])]) !== baseline,
    onDirtyChange,
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!edit.name) return;
    onSubmit(edit);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        id={`${idPrefix}-name`}
        label="Name *"
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />

      {known.map(({ field, spec }) => (
        <spec.Input
          key={field.key}
          id={`${idPrefix}-${field.key}`}
          field={field}
          value={draftOf(field.key)}
          onChange={(value) => setDrafts((prev) => ({ ...prev, [field.key]: value }))}
        />
      ))}

      <div className={`flex justify-end gap-3 ${variant === 'modal' ? 'pt-4' : 'pt-2'}`}>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" data-testid={submitButtonTestId}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
};
