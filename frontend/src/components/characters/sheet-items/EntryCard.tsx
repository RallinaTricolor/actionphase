import { useState, type ReactNode } from 'react';
import { Button, MetadataItem } from '@/components/ui';
import type { CharacterSheetField } from '@/types/characters';
import type { EntryEdit, SheetEntry } from '@/lib/sheetEntries';
import { EntryForm } from './EntryForm';
import { fieldTypeOf, type FieldGroup } from './fieldTypes';

interface EntryCardProps {
  entry: SheetEntry;
  /** The tab's schema, which decides what the card shows and in what order. */
  fields: readonly CharacterSheetField[];
  canEdit: boolean;
  onUpdate: (edit: EntryEdit) => void;
  onRemove: () => void;
  /** Reports whether this card's inline editor holds uncommitted edits. */
  onDirtyChange?: (isDirty: boolean) => void;
}

interface Rendered {
  field: CharacterSheetField;
  content: ReactNode;
}

/**
 * One entry on any configurable tab.
 *
 * Every tab lays out the same way, in schema order within each group: header,
 * then text and number fields as label/value pairs, then tracks, then markdown
 * fields as collapsible sections, then select values and checked checkboxes as
 * badges. Empty fields are left out.
 */
export const EntryCard: React.FC<EntryCardProps> = ({ entry, fields, canEdit, onUpdate, onRemove, onDirtyChange }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());

  if (isEditing) {
    return (
      <div className="border border-theme-default rounded-lg p-4 surface-base">
        <EntryForm
          fields={fields}
          initialEntry={entry}
          onSubmit={(edit) => {
            onUpdate(edit);
            setIsEditing(false);
          }}
          onCancel={() => setIsEditing(false)}
          submitLabel="Save"
          variant="inline"
          onDirtyChange={onDirtyChange}
        />
      </div>
    );
  }

  const groups: Record<FieldGroup, Rendered[]> = { meta: [], track: [], section: [], badge: [] };
  for (const field of fields) {
    const spec = fieldTypeOf(field);
    const content = spec?.render(entry[field.key], field, entry.name);
    if (spec && content !== null && content !== undefined) {
      groups[spec.group].push({ field, content });
    }
  }

  const toggle = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (!next.delete(key)) next.add(key);
      return next;
    });

  return (
    <div className="border border-theme-default rounded-lg p-4 surface-base space-y-3" data-testid="sheet-entry">
      <div className="flex justify-between items-start gap-2">
        <h4 className="text-base font-semibold text-content-primary">{entry.name}</h4>
        {canEdit && (
          <div className="flex space-x-1 flex-shrink-0">
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

      {groups.meta.length > 0 && (
        // One or two read as a single line, like the old "Rank: 3"; more wrap
        // into a grid so a six-attribute entry stays scannable.
        <div className={groups.meta.length > 2 ? 'grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1' : 'flex flex-wrap gap-x-4 gap-y-1'}>
          {groups.meta.map(({ field, content }) => (
            <MetadataItem key={field.key} label={field.label} value={content} />
          ))}
        </div>
      )}

      {groups.track.map(({ field, content }) => (
        <div key={field.key}>{content}</div>
      ))}

      {groups.section.map(({ field, content }) => {
        const isExpanded = expanded.has(field.key);
        return (
          <div key={field.key}>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => toggle(field.key)}
              aria-expanded={isExpanded}
              className="flex items-center gap-1 px-2 py-1 text-content-secondary hover:text-content-primary"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d={isExpanded ? 'M19 9l-7 7-7-7' : 'M9 5l7 7-7 7'}
                />
              </svg>
              <span>{field.label}</span>
            </Button>
            {isExpanded && <div className="mt-2 text-sm">{content}</div>}
          </div>
        );
      })}

      {groups.badge.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {groups.badge.map(({ field, content }) => (
            <span key={field.key}>{content}</span>
          ))}
        </div>
      )}
    </div>
  );
};
