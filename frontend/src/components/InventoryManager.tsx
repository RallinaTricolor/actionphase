import React, { useState } from 'react';
import type { InventoryItem, CurrencyEntry } from '../types/characters';

interface InventoryManagerProps {
  items: InventoryItem[];
  currency: CurrencyEntry[];
  canEdit: boolean;
  onItemsChange: (items: InventoryItem[]) => void;
  onCurrencyChange: (currency: CurrencyEntry[]) => void;
}

export const InventoryManager: React.FC<InventoryManagerProps> = ({
  items,
  currency,
  canEdit,
  onItemsChange,
  onCurrencyChange
}) => {
  const [activeTab, setActiveTab] = useState<'items' | 'currency'>('items');
  const [showAddItem, setShowAddItem] = useState(false);
  const [showAddCurrency, setShowAddCurrency] = useState(false);

  const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const addItem = (itemData: Omit<InventoryItem, 'id'>) => {
    const newItem: InventoryItem = {
      id: generateId(),
      ...itemData
    };
    onItemsChange([...items, newItem]);
    setShowAddItem(false);
  };

  const addCurrency = (currencyData: Omit<CurrencyEntry, 'id'>) => {
    const newCurrency: CurrencyEntry = {
      id: generateId(),
      ...currencyData
    };
    onCurrencyChange([...currency, newCurrency]);
    setShowAddCurrency(false);
  };

  const removeItem = (id: string) => {
    onItemsChange(items.filter(i => i.id !== id));
  };

  const removeCurrency = (id: string) => {
    onCurrencyChange(currency.filter(c => c.id !== id));
  };

  const updateItem = (id: string, updates: Partial<InventoryItem>) => {
    onItemsChange(items.map(i => i.id === id ? { ...i, ...updates } : i));
  };

  const updateCurrency = (id: string, updates: Partial<CurrencyEntry>) => {
    onCurrencyChange(currency.map(c => c.id === id ? { ...c, ...updates } : c));
  };

  const getTotalWeight = () => {
    return items.reduce((total, item) => total + ((item.weight || 0) * item.quantity), 0);
  };

  const getTotalValue = () => {
    return items.reduce((total, item) => total + ((item.value || 0) * item.quantity), 0);
  };

  return (
    <div>
      {/* Tab Navigation */}
      <div className="flex space-x-1 mb-6 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('items')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'items'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Items ({items.length})
        </button>
        <button
          onClick={() => setActiveTab('currency')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'currency'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Currency ({currency.length})
        </button>
      </div>

      {/* Items Tab */}
      {activeTab === 'items' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="text-lg font-medium text-gray-900">Items</h3>
              {items.length > 0 && (
                <div className="text-sm text-gray-500 mt-1">
                  Total Weight: {getTotalWeight().toFixed(1)} • Total Value: {getTotalValue()}
                </div>
              )}
            </div>
            {canEdit && (
              <button
                onClick={() => setShowAddItem(true)}
                className="px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Add Item
              </button>
            )}
          </div>

          {items.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No items yet.</p>
              {canEdit && <p className="text-sm mt-1">Click "Add Item" to get started.</p>}
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((item) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  canEdit={canEdit}
                  onUpdate={(updates) => updateItem(item.id, updates)}
                  onRemove={() => removeItem(item.id)}
                />
              ))}
            </div>
          )}

          {showAddItem && (
            <AddItemModal
              onAdd={addItem}
              onCancel={() => setShowAddItem(false)}
            />
          )}
        </div>
      )}

      {/* Currency Tab */}
      {activeTab === 'currency' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-gray-900">Currency & Resources</h3>
            {canEdit && (
              <button
                onClick={() => setShowAddCurrency(true)}
                className="px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Add Currency
              </button>
            )}
          </div>

          {currency.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No currency tracked yet.</p>
              {canEdit && <p className="text-sm mt-1">Click "Add Currency" to get started.</p>}
            </div>
          ) : (
            <div className="space-y-3">
              {currency.map((curr) => (
                <CurrencyCard
                  key={curr.id}
                  currency={curr}
                  canEdit={canEdit}
                  onUpdate={(updates) => updateCurrency(curr.id, updates)}
                  onRemove={() => removeCurrency(curr.id)}
                />
              ))}
            </div>
          )}

          {showAddCurrency && (
            <AddCurrencyModal
              onAdd={addCurrency}
              onCancel={() => setShowAddCurrency(false)}
            />
          )}
        </div>
      )}
    </div>
  );
};

// Item Card Component
interface ItemCardProps {
  item: InventoryItem;
  canEdit: boolean;
  onUpdate: (updates: Partial<InventoryItem>) => void;
  onRemove: () => void;
}

const ItemCard: React.FC<ItemCardProps> = ({ item, canEdit, onUpdate, onRemove }) => {
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

// Currency Card Component
interface CurrencyCardProps {
  currency: CurrencyEntry;
  canEdit: boolean;
  onUpdate: (updates: Partial<CurrencyEntry>) => void;
  onRemove: () => void;
}

const CurrencyCard: React.FC<CurrencyCardProps> = ({ currency, canEdit, onUpdate, onRemove }) => {
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

// Add Item Modal
interface AddItemModalProps {
  onAdd: (item: Omit<InventoryItem, 'id'>) => void;
  onCancel: () => void;
}

const AddItemModal: React.FC<AddItemModalProps> = ({ onAdd, onCancel }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [category, setCategory] = useState('');
  const [value, setValue] = useState<number | ''>('');
  const [weight, setWeight] = useState<number | ''>('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    onAdd({
      name: name.trim(),
      description: description.trim() || undefined,
      quantity,
      category: category.trim() || undefined,
      value: value || undefined,
      weight: weight || undefined,
      equipped: false
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h3 className="text-lg font-medium mb-4">Add New Item</h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Item Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., Iron Sword, Health Potion"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Quantity
              </label>
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                min="1"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Category
              </label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Weapon, Armor, etc."
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Value
              </label>
              <input
                type="number"
                value={value}
                onChange={(e) => setValue(parseInt(e.target.value) || '')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                min="0"
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Weight
              </label>
              <input
                type="number"
                value={weight}
                onChange={(e) => setWeight(parseFloat(e.target.value) || '')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                min="0"
                step="0.1"
                placeholder="0.0"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Describe this item..."
              rows={2}
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
              Add Item
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Add Currency Modal
interface AddCurrencyModalProps {
  onAdd: (currency: Omit<CurrencyEntry, 'id'>) => void;
  onCancel: () => void;
}

const AddCurrencyModal: React.FC<AddCurrencyModalProps> = ({ onAdd, onCancel }) => {
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
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Currency Type *
            </label>
            <input
              type="text"
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., Gold, Credits, XP, Reputation"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Amount
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(parseInt(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              min="0"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <input
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
