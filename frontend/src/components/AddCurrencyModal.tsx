import { useState } from 'react';
import type { CurrencyEntry } from '../types/characters';
import { Button, Input } from './ui';
import { Modal } from './Modal';

interface AddCurrencyModalProps {
  onAdd: (currency: Omit<CurrencyEntry, 'id'>) => void;
  onCancel: () => void;
}

export const AddCurrencyModal: React.FC<AddCurrencyModalProps> = ({ onAdd, onCancel }) => {
  const [type, setType] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!type.trim()) return;

    onAdd({
      type: type.trim(),
      amount: parseInt(amount) || 0,
      description: description.trim() || undefined
    });
  };

  return (
    <Modal isOpen={true} onClose={onCancel} title="Add Currency/Resource">
      <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            id="currency-type"
            label="Currency Type *"
            type="text"
            value={type}
            onChange={(e) => setType(e.target.value)}
            placeholder="e.g., Gold, Credits, XP, Reputation"
            required
          />

          <Input
            id="currency-amount"
            label="Amount"
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
            min={0}
          />

          <Input
            id="currency-description"
            label="Description"
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional notes..."
          />

        <div className="flex justify-end space-x-3 pt-4">
          <Button
            type="button"
            variant="ghost"
            onClick={onCancel}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
          >
            Add Currency
          </Button>
        </div>
      </form>
    </Modal>
  );
};
