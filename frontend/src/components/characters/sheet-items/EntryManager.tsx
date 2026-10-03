import React, { useState, useMemo } from 'react';
import type { SheetTab } from '@/types/characters';
import { Button } from '@/components/ui';
import { generateId } from '@/utils/generateId';
import { ensureIds } from '@/utils/ensureIds';
import { useDirtyChildren } from '@/hooks/useDirtyChildren';
import { applyEntryEdit, createEntry, normalizeEntry, type EntryEdit, type RawSheetEntry } from '@/lib/sheetEntries';
import type { LootRolling } from '@/hooks/useLootRoll';
import { EntryCard } from './EntryCard';
import { AddEntryModal } from './AddEntryModal';

interface EntryManagerProps {
  /** The tab from the game's resolved layout: its key, label and schema. */
  tab: SheetTab;
  /** The tab's stored entries, exactly as parsed from its blob. */
  entries: readonly RawSheetEntry[];
  canEdit: boolean;
  onEntriesChange: (entries: RawSheetEntry[]) => void;
  /**
   * Reports whether any editor below holds edits that have not been committed
   * with Save. Ancestors use it to warn before closing the sheet.
   */
  onDirtyChange?: (isDirty: boolean) => void;
  /** Offers adding from the loot tables that roll into this tab. */
  loot?: LootRolling;
}

/**
 * One configurable tab of the character sheet: a list of entries laid out by
 * the tab's schema. Every configurable tab renders through this, whatever the
 * GM called it or put in it.
 *
 * Only the entry being edited is rewritten on save. The rest go back exactly as
 * stored, legacy keys and all, so a GM who adds an entry and removes it again
 * produces a list identical to the published one (the draft modal relies on
 * that to drop a no-op draft).
 */
export const EntryManager: React.FC<EntryManagerProps> = ({
  tab,
  entries,
  canEdit,
  onEntriesChange,
  onDirtyChange,
  loot,
}) => {
  const { report: reportDirty } = useDirtyChildren(onDirtyChange);
  // Defensive: ensure every row has an ID (protects against draft-merge corruption)
  const rows = useMemo(() => ensureIds([...entries], tab.label), [entries, tab.label]);
  const view = useMemo(() => rows.map((row) => normalizeEntry(tab.key, row)), [rows, tab.key]);

  const [showAdd, setShowAdd] = useState(false);

  const addEntry = (edit: EntryEdit) => {
    onEntriesChange([...rows, createEntry(generateId(), edit)]);
    setShowAdd(false);
  };

  const rollLoot = async (lootTableId: number) => {
    // Only a successful roll closes the modal, so a failed one can be retried
    // without choosing the table again.
    if (await loot?.roll(lootTableId, tab.key)) setShowAdd(false);
  };

  const removeEntry = (id: string) => {
    onEntriesChange(rows.filter((row) => row.id !== id));
  };

  const updateEntry = (index: number, edit: EntryEdit) => {
    onEntriesChange(rows.map((row, i) => (i === index ? applyEntryEdit(view[index], edit) : row)));
  };

  return (
    <div data-testid={`${tab.key}-section`}>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium text-content-primary">{tab.label}</h3>
        {canEdit && (
          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowAdd(true)}
            // The visible text stays generic: "Add Skills" reads wrong for a
            // control that adds one entry, and no rule can singularise a
            // GM's label. The label reaches assistive tech here instead.
            aria-label={`Add to ${tab.label}`}
            data-testid={`add-${tab.key}`}
          >
            Add New
          </Button>
        )}
      </div>

      {view.length === 0 ? (
        <div className="text-center py-8 text-content-secondary">
          <p>No {tab.label.toLowerCase()} yet.</p>
          {canEdit && <p className="text-sm mt-1">Click "Add New" to get started.</p>}
        </div>
      ) : (
        <div className="space-y-3">
          {view.map((entry, index) => (
            <EntryCard
              key={entry.id}
              entry={entry}
              fields={tab.fields}
              canEdit={canEdit}
              onUpdate={(edit) => updateEntry(index, edit)}
              onRemove={() => removeEntry(entry.id)}
              onDirtyChange={(isDirty) => reportDirty(`entry:${entry.id}`, isDirty)}
            />
          ))}
        </div>
      )}

      {showAdd && (
        <AddEntryModal
          fields={tab.fields}
          onAdd={addEntry}
          onCancel={() => setShowAdd(false)}
          lootModes={loot?.modes}
          lootTargetTab={tab.key}
          onAddRandom={loot ? rollLoot : undefined}
        />
      )}
    </div>
  );
};
