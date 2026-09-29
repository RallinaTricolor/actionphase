import { useState } from 'react';
import type { NumberEntry } from '@/types/characters';
import { numberEntryName } from '@/types/characters';
import { Button } from '@/components/ui';
import { MarkdownPreview } from '@/components/common/markdown/MarkdownPreview';
import { NumberForm, type NumberFormData } from './NumberForm';
import { BoxTrack, BarTrack } from './TrackDisplay';
import { trackVisual } from '@/lib/sheetEntries';

interface NumberCardProps {
  entry: NumberEntry;
  canEdit: boolean;
  onUpdate: (updates: Partial<NumberEntry>) => void;
  onRemove: () => void;
  /** Reports whether this card's inline editor holds uncommitted edits. */
  onDirtyChange?: (isDirty: boolean) => void;
}

export const NumberCard: React.FC<NumberCardProps> = ({ entry, canEdit, onUpdate, onRemove, onDirtyChange }) => {
  const [isEditing, setIsEditing] = useState(false);
  const name = numberEntryName(entry);

  const handleSave = (data: NumberFormData) => {
    onUpdate({
      name: data.name,
      amount: data.amount,
      max: data.max,
      display: data.display,
      description: data.description,
      // Clear the legacy key so an edited row stops carrying both spellings of
      // its name. Rows nobody edits keep it and read through the fallback,
      // which is why this is not a migration.
      type: undefined,
    });
    setIsEditing(false);
  };

  // Swaps the whole card for the shared form while editing, as SkillCard and
  // ItemCard do. This tab used to hand-roll its own inline editor with ✓/✕ icon
  // buttons, which was the only editor on the sheet that did not present a
  // labelled Cancel/Save pair.
  if (isEditing) {
    return (
      <div className="border border-theme-default rounded-lg p-4 surface-base">
        <NumberForm
          initialValues={{
            name,
            amount: entry.amount,
            max: entry.max,
            display: entry.display,
            description: entry.description,
          }}
          onSubmit={handleSave}
          onCancel={() => setIsEditing(false)}
          submitLabel="Save"
          variant="inline"
          onDirtyChange={onDirtyChange}
        />
      </div>
    );
  }

  const visual = trackVisual({ value: entry.amount, max: entry.max, display: entry.display });
  const max = entry.max ?? 0;
  const showBoxes = visual === 'boxes';
  const showBar = visual === 'bar';

  return (
    <div className="border border-theme-default rounded-lg p-4 surface-base">
      <div className="flex justify-between items-center">
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <span className="font-medium text-content-primary">{name}</span>
            <span className="text-lg font-semibold text-semantic-success">
              {entry.amount.toLocaleString()}
              {entry.max !== undefined && (
                <span className="text-content-tertiary font-normal"> / {entry.max.toLocaleString()}</span>
              )}
            </span>
          </div>
        </div>

        {canEdit && (
          <div className="flex space-x-1 ml-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsEditing(true)}
              className="p-1 text-interactive-primary hover:text-interactive-primary-hover"
              aria-label="Edit entry"
            >
              ✎
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onRemove}
              className="p-1 text-semantic-danger hover:text-semantic-danger"
              aria-label="Remove entry"
            >
              🗑
            </Button>
          </div>
        )}
      </div>

      {(showBoxes || showBar) && (
        <div className="mt-2">
          {showBoxes ? (
            <BoxTrack filled={entry.amount} total={max} label={name} />
          ) : (
            <BarTrack filled={entry.amount} total={max} label={name} />
          )}
        </div>
      )}

      {entry.description && (
        <div className="mt-2">
          <div className="text-sm">
            <MarkdownPreview content={entry.description} />
          </div>
        </div>
      )}
    </div>
  );
};
