import { useState } from 'react';
import type { CurrencyEntry } from '../types/characters';
import { Button, Input } from './ui';

interface AddCurrencyModalProps {
  onAdd: (currency: Omit<CurrencyEntry, 'id'>) => void;
  onCancel: () => void;
}

export const AddCurrencyModal: React.FC<AddCurrencyModalProps> = ({ onAdd, onCancel }) => {
  const [type, setType] = useState('');
  const [amount, setAmount] = useState(0);
  const [description, setDescription] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!type.trim()) return;

    onAdd({
      type: type.trim(),
      amount,
      description: description.trim() || undefined
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="surface-base rounded-lg p-6 w-full max-w-md">
        <h3 className="text-lg font-medium text-content-primary mb-4">Add Currency/Resource</h3>

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
            onChange={(e) => setAmount(parseInt(e.target.value) || 0)}
            min={0}
            required
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
      </div>
    </div>
  );
};
