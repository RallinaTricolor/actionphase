import { useState } from 'react';
import type { CurrencyEntry } from '../types/characters';

interface CurrencyCardProps {
  currency: CurrencyEntry;
  canEdit: boolean;
  onUpdate: (updates: Partial<CurrencyEntry>) => void;
  onRemove: () => void;
}

export const CurrencyCard: React.FC<CurrencyCardProps> = ({ currency, canEdit, onUpdate, onRemove }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editType, setEditType] = useState(currency.type);
  const [editAmount, setEditAmount] = useState(currency.amount);
  const [editDescription, setEditDescription] = useState(currency.description || '');

  const handleSave = () => {
    onUpdate({
      type: editType,
      amount: editAmount,
      description: editDescription || undefined
    });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditType(currency.type);
    setEditAmount(currency.amount);
    setEditDescription(currency.description || '');
    setIsEditing(false);
  };

  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-white">
      <div className="flex justify-between items-center">
        <div className="flex-1">
          {isEditing ? (
            <div className="flex items-center space-x-3">
              <input
                type="text"
                value={editType}
                onChange={(e) => setEditType(e.target.value)}
                className="font-medium border-b border-gray-300 focus:border-blue-500 focus:outline-none bg-transparent"
                placeholder="Currency type..."
              />
              <input
                type="number"
                value={editAmount}
                onChange={(e) => setEditAmount(parseInt(e.target.value) || 0)}
                className="w-24 text-right border border-gray-300 rounded px-2 py-1 focus:border-blue-500 focus:outline-none"
              />
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <span className="font-medium text-gray-900">{currency.type}</span>
              <span className="text-lg font-semibold text-green-600">{currency.amount.toLocaleString()}</span>
            </div>
          )}
        </div>

        {canEdit && (
          <div className="flex space-x-1 ml-4">
            {isEditing ? (
              <>
                <button
                  onClick={handleSave}
                  className="p-1 text-green-600 hover:text-green-800"
                >
                  ✓
                </button>
                <button
                  onClick={handleCancel}
                  className="p-1 text-gray-600 hover:text-gray-800"
                >
                  ✕
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setIsEditing(true)}
                  className="p-1 text-blue-600 hover:text-blue-800"
                >
                  ✎
                </button>
                <button
                  onClick={onRemove}
                  className="p-1 text-red-600 hover:text-red-800"
                >
                  🗑
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {(currency.description || isEditing) && (
        <div className="mt-2">
          {isEditing ? (
            <input
              type="text"
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              className="w-full text-sm text-gray-600 border border-gray-300 rounded px-2 py-1 focus:border-blue-500 focus:outline-none"
              placeholder="Notes about this currency..."
            />
          ) : (
            <p className="text-sm text-gray-600">{currency.description}</p>
          )}
        </div>
      )}
    </div>
  );
};
