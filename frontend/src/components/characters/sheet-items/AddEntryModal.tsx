import type { CharacterSheetField } from '@/types/characters';
import { Modal } from '@/components/common/modals/Modal';
import type { EntryEdit } from '@/lib/sheetEntries';
import { EntryForm } from './EntryForm';

interface AddEntryModalProps {
  fields: readonly CharacterSheetField[];
  onAdd: (edit: EntryEdit) => void;
  onCancel: () => void;
}

export const AddEntryModal: React.FC<AddEntryModalProps> = ({ fields, onAdd, onCancel }) => (
  // dismissOnBackdrop: a stray backdrop click must not discard the half-typed
  // entry held in EntryForm's local state.
  <Modal isOpen={true} onClose={onCancel} title="Add New" dismissOnBackdrop={false}>
    <EntryForm fields={fields} onSubmit={onAdd} onCancel={onCancel} submitLabel="Add" variant="modal" />
  </Modal>
);
