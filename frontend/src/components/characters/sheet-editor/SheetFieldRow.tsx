import { useId, useState } from 'react';
import { Badge, Button, Input, Textarea } from '@/components/ui';
import type { CharacterSheetField } from '@/types/characters';
import { fieldTypeLabel, parseOptions } from '@/lib/sheetLayoutEditing';
import { ReorderButtons } from './ReorderButtons';
import { ConfirmRemoval } from './ConfirmRemoval';

interface SheetFieldRowProps {
  field: CharacterSheetField;
  /** This field's problems, from layoutProblems. */
  problems: string[];
  canMoveUp: boolean;
  canMoveDown: boolean;
  onChange: (field: CharacterSheetField) => void;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
  /**
   * The confirmation to show before removing, or null to remove at once
   * (nothing stored would be hidden).
   */
  removalMessage: string | null;
}

/**
 * One field of a tab in the editor. The name and a select's options can
 * change; the type can't, so values already stored are never reinterpreted.
 */
export function SheetFieldRow({
  field,
  problems,
  canMoveUp,
  canMoveDown,
  onChange,
  onMove,
  onRemove,
  removalMessage,
}: SheetFieldRowProps) {
  const id = useId();
  const [confirming, setConfirming] = useState(false);
  // The textarea's own text, so a half-typed line or a blank line between
  // options survives; the field keeps only the parsed options.
  const [optionsText, setOptionsText] = useState(() => (field.options ?? []).join('\n'));
  const name = field.label.trim() || 'field';

  return (
    <li className="rounded-lg border border-theme-default surface-base p-3 space-y-3" data-testid={`sheet-field-${field.key}`}>
      <div className="flex flex-wrap items-start gap-2">
        <div className="flex-1 min-w-[12rem]">
          <Input
            id={`${id}-label`}
            label="Field name"
            value={field.label}
            onChange={(e) => onChange({ ...field, label: e.target.value })}
            inputSize="sm"
          />
        </div>
        <div className="flex items-center gap-1 sm:pt-7">
          <Badge variant="neutral" size="sm">{fieldTypeLabel(field.type)}</Badge>
          <ReorderButtons name={name} canMoveUp={canMoveUp} canMoveDown={canMoveDown} onMove={onMove} />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-semantic-danger"
            onClick={() => (removalMessage ? setConfirming(true) : onRemove())}
            aria-label={`Remove ${name}`}
          >
            Remove
          </Button>
        </div>
      </div>

      {field.type === 'select' && (
        <Textarea
          id={`${id}-options`}
          label="Options"
          helperText="One per line."
          rows={3}
          value={optionsText}
          onChange={(e) => {
            setOptionsText(e.target.value);
            onChange({ ...field, options: parseOptions(e.target.value) });
          }}
        />
      )}

      {problems.length > 0 && (
        <ul className="text-sm text-semantic-danger space-y-1">
          {problems.map((problem) => <li key={problem}>{problem}</li>)}
        </ul>
      )}

      {confirming && removalMessage && (
        <ConfirmRemoval message={removalMessage} onRemove={onRemove} onKeep={() => setConfirming(false)} />
      )}
    </li>
  );
}
