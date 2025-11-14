import { useState } from 'react';
import type { CurrencyEntry } from '../../types/characters';
import { Button, Input } from '../ui';

export interface CurrencyFormData {
  type: string;
  amount: number;
  description?: string;
}

interface CurrencyFormProps {
  onSubmit: (data: CurrencyFormData) => void;
  onCancel: () => void;
  initialValues?: Partial<CurrencyFormData>;
  submitLabel?: string;
  variant?: 'modal' | 'inline';
  submitButtonTestId?: string;
}

/**
 * Shared form component for adding/editing currency entries.
 * Used in both AddCurrencyModal and CurrencyTab to ensure consistency.
 */
export const CurrencyForm: React.FC<CurrencyFormProps> = ({
  onSubmit,
  onCancel,
  initialValues,
  submitLabel = 'Add Currency',
  variant = 'modal',
  submitButtonTestId,
}) => {
  const [type, setType] = useState(initialValues?.type || '');
  const [amount, setAmount] = useState(initialValues?.amount?.toString() || '');
  const [description, setDescription] = useState(initialValues?.description || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!type.trim()) return;

    onSubmit({
      type: type.trim(),
      amount: parseInt(amount) || 0,
      description: description.trim() || undefined,
    });
  };

  return (
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

      <div className={`flex justify-end gap-3 ${variant === 'modal' ? 'pt-4' : 'pt-2'}`}>
        <Button
          type="button"
          variant="secondary"
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          variant="primary"
          data-testid={submitButtonTestId}
        >
          {submitLabel}
        </Button>
      </div>
    </form>
  );
};
