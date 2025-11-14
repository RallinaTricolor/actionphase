import type { CurrencyEntry } from '../types/characters';
import { Modal } from './Modal';
import { CurrencyForm, type CurrencyFormData } from './character-updates/CurrencyForm';

interface AddCurrencyModalProps {
  onAdd: (currency: Omit<CurrencyEntry, 'id'>) => void;
  onCancel: () => void;
}

export const AddCurrencyModal: React.FC<AddCurrencyModalProps> = ({ onAdd, onCancel }) => {
  const handleSubmit = (data: CurrencyFormData) => {
    onAdd({
      type: data.type,
      amount: data.amount,
      description: data.description
    });
  };

  return (
    <Modal isOpen={true} onClose={onCancel} title="Add Currency/Resource">
      <CurrencyForm
        onSubmit={handleSubmit}
        onCancel={onCancel}
        submitLabel="Add Currency"
        variant="modal"
      />
    </Modal>
  );
};
