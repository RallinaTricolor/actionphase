import { useId, useState } from 'react';
import { Button, Input, Select, Textarea } from '@/components/ui';
import {
  FIELD_TYPES,
  SHEET_LIMITS,
  labelProblem,
  optionProblems,
  parseOptions,
  type SheetFieldType,
} from '@/lib/sheetLayoutEditing';

interface AddSheetFieldFormProps {
  onAdd: (label: string, type: SheetFieldType, options: string[]) => void;
  onCancel: () => void;
}

/** Adds a field to a tab: a name, a type (fixed once added), and a choice's options. */
export function AddSheetFieldForm({ onAdd, onCancel }: AddSheetFieldFormProps) {
  const id = useId();
  const [label, setLabel] = useState('');
  const [type, setType] = useState<SheetFieldType>('text');
  const [optionsText, setOptionsText] = useState('');
  // Problems show only once the GM has tried to add, not while they type.
  const [attempted, setAttempted] = useState(false);

  const options = parseOptions(optionsText);
  const labelError = labelProblem(label, SHEET_LIMITS.fieldLabel, true);
  const optionErrors = type === 'select' ? optionProblems(options) : [];
  const hint = FIELD_TYPES.find((t) => t.type === type)?.hint;

  const submit = () => {
    setAttempted(true);
    if (labelError || optionErrors.length > 0) return;
    onAdd(label, type, options);
  };

  return (
    <div className="rounded-lg border border-theme-strong surface-raised p-3 space-y-3" data-testid="add-sheet-field-form">
      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          id={`${id}-label`}
          label="Field name"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          error={attempted ? labelError ?? undefined : undefined}
          inputSize="sm"
          autoFocus
        />
        <Select
          id={`${id}-type`}
          label="Type"
          value={type}
          onChange={(e) => setType(e.target.value as SheetFieldType)}
          helperText={hint}
          selectSize="sm"
        >
          {FIELD_TYPES.map((t) => (
            <option key={t.type} value={t.type}>{t.label}</option>
          ))}
        </Select>
      </div>

      {type === 'select' && (
        <Textarea
          id={`${id}-options`}
          label="Options"
          helperText="One per line."
          rows={3}
          value={optionsText}
          onChange={(e) => setOptionsText(e.target.value)}
          error={attempted && optionErrors.length > 0 ? optionErrors.join(' ') : undefined}
        />
      )}

      <p className="text-xs text-content-tertiary">The type can’t be changed after the field is added.</p>

      <div className="flex gap-2">
        <Button type="button" variant="primary" size="sm" onClick={submit}>
          Add field
        </Button>
        <Button type="button" variant="secondary" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
