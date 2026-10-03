import type { CharacterSheetField } from '@/types/characters';
import { Modal } from '@/components/common/modals/Modal';
import type { EntryEdit } from '@/lib/sheetEntries';
import type { LootMode } from '@/hooks/useLootRoll';
import { EntryForm } from './EntryForm';
import { LootModeForm } from './LootModeForm';

interface AddEntryModalProps {
  fields: readonly CharacterSheetField[];
  onAdd: (edit: EntryEdit) => void;
  onCancel: () => void;
  /**
   * Offers adding from a loot table too. Absent or manual-only means a plain
   * form.
   */
  lootModes?: readonly LootMode[];
  /** The tab being added to: only loot tables rolling into it are offered. */
  lootTargetTab?: string;
  /** Required for 'loot_table_random': the roll happens server-side. */
  onAddRandom?: (lootTableId: number) => void;
}

export const AddEntryModal: React.FC<AddEntryModalProps> = ({ fields, onAdd, onCancel, lootModes, lootTargetTab, onAddRandom }) => (
  // dismissOnBackdrop: a stray backdrop click must not discard the half-typed
  // entry held in the form's local state.
  <Modal isOpen={true} onClose={onCancel} title="Add New" dismissOnBackdrop={false}>
    {lootTargetTab && lootModes?.some((mode) => mode !== 'manual') ? (
      <LootModeForm
        fields={fields}
        targetTab={lootTargetTab}
        lootModes={lootModes}
        onAdd={onAdd}
        onAddRandom={onAddRandom}
        onCancel={onCancel}
      />
    ) : (
      <EntryForm fields={fields} onSubmit={onAdd} onCancel={onCancel} submitLabel="Add" variant="modal" />
    )}
  </Modal>
);
