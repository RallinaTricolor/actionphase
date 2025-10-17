import { useState } from 'react';
import type { InventoryItem } from '../types/characters';

interface ItemCardProps {
  item: InventoryItem;
  canEdit: boolean;
  onUpdate: (updates: Partial<InventoryItem>) => void;
  onRemove: () => void;
}

export const ItemCard: React.FC<ItemCardProps> = ({ item, canEdit, onUpdate, onRemove }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(item.name);
  const [editQuantity, setEditQuantity] = useState(item.quantity);
  const [editDescription, setEditDescription] = useState(item.description || '');

  const handleSave = () => {
    onUpdate({
      name: editName,
      quantity: editQuantity,
      description: editDescription || undefined
    });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditName(item.name);
    setEditQuantity(item.quantity);
    setEditDescription(item.description || '');
    setIsEditing(false);
  };

  const getCategoryColor = (category?: string) => {
    if (!category) return 'bg-gray-100 text-gray-800';

    switch (category.toLowerCase()) {
      case 'weapon':
        return 'bg-red-100 text-red-800';
      case 'armor':
        return 'bg-blue-100 text-blue-800';
      case 'consumable':
        return 'bg-green-100 text-green-800';
      case 'tool':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-white">
      <div className="flex justify-between items-start mb-2">
        <div className="flex-1">
          {isEditing ? (
            <div className="space-y-2">
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="text-lg font-medium border-b border-gray-300 focus:border-blue-500 focus:outline-none bg-transparent"
                placeholder="Item name..."
              />
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600">Qty:</span>
                <input
                  type="number"
                  value={editQuantity}
                  onChange={(e) => setEditQuantity(parseInt(e.target.value) || 1)}
                  className="w-20 text-sm border border-gray-300 rounded px-2 py-1 focus:border-blue-500 focus:outline-none"
                  min="1"
                />
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-center space-x-2">
                <h4 className="text-lg font-medium text-gray-900">{item.name}</h4>
                {item.quantity > 1 && (
                  <span className="text-sm text-gray-600 bg-gray-100 px-2 py-1 rounded">
                    x{item.quantity}
                  </span>
                )}
                {item.equipped && (
                  <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                    Equipped
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center space-x-2 ml-4">
          {item.category && (
            <span className={`px-2 py-1 text-xs font-medium rounded-full ${getCategoryColor(item.category)}`}>
              {item.category}
            </span>
          )}

          {canEdit && (
            <div className="flex space-x-1">
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
      </div>

      {(item.description || isEditing) && (
        <div className="mb-2">
          {isEditing ? (
            <textarea
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              className="w-full text-sm text-gray-600 border border-gray-300 rounded p-2 focus:border-blue-500 focus:outline-none"
              placeholder="Describe this item..."
              rows={2}
            />
          ) : (
            <p className="text-sm text-gray-600">{item.description}</p>
          )}
        </div>
      )}

      {/* Item Stats */}
      <div className="flex flex-wrap gap-4 text-xs text-gray-500">
        {item.weight && (
          <span>Weight: {item.weight * item.quantity}</span>
        )}
        {item.value && (
          <span>Value: {item.value * item.quantity}</span>
        )}
        {item.condition && (
          <span>Condition: {item.condition}</span>
        )}
      </div>
    </div>
  );
};
