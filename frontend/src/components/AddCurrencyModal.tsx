import { useState } from 'react';
import type { CurrencyEntry } from '../types/characters';

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
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h3 className="text-lg font-medium mb-4">Add Currency/Resource</h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="currency-type" className="block text-sm font-medium text-gray-700 mb-1">
              Currency Type *
            </label>
            <input
              id="currency-type"
              type="text"
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., Gold, Credits, XP, Reputation"
              required
            />
          </div>

          <div>
            <label htmlFor="currency-amount" className="block text-sm font-medium text-gray-700 mb-1">
              Amount
            </label>
            <input
              id="currency-amount"
              type="number"
              value={amount}
              onChange={(e) => setAmount(parseInt(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              min="0"
              required
            />
          </div>

          <div>
            <label htmlFor="currency-description" className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <input
              id="currency-description"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Optional notes..."
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700"
            >
              Add Currency
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
