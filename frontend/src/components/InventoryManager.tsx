import React, { useState } from 'react';
import type { InventoryItem, CurrencyEntry } from '../types/characters';
import { ItemCard } from './ItemCard';
import { CurrencyCard } from './CurrencyCard';
import { AddItemModal } from './AddItemModal';
import { AddCurrencyModal } from './AddCurrencyModal';
import { Button } from './ui';

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
      {/* Tab Navigation - Hide currency tab if user cannot edit */}
      <div className="flex space-x-1 mb-6 border-b border-theme-default">
        <Button
          variant="ghost"
          onClick={() => setActiveTab('items')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'items'
              ? 'border-interactive-primary text-interactive-primary'
              : 'border-transparent text-content-secondary hover:text-content-primary'
          }`}
        >
          Items ({items.length})
        </Button>
        <Button
          variant="ghost"
          onClick={() => setActiveTab('currency')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'currency'
              ? 'border-interactive-primary text-interactive-primary'
              : 'border-transparent text-content-secondary hover:text-content-primary'
          }`}
        >
          Currency ({currency.length})
        </Button>
      </div>

      {/* Items Tab */}
      {activeTab === 'items' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="text-lg font-medium text-content-primary">Items</h3>
              {items.length > 0 && (
                <div className="text-sm text-content-tertiary mt-1">
                  Total Weight: {getTotalWeight().toFixed(1)} • Total Value: {getTotalValue()}
                </div>
              )}
            </div>
            {canEdit && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setShowAddItem(true)}
              >
                Add Item
              </Button>
            )}
          </div>

          {items.length === 0 ? (
            <div className="text-center py-8 text-content-secondary">
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
            <h3 className="text-lg font-medium text-content-primary">Currency & Resources</h3>
            {canEdit && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setShowAddCurrency(true)}
              >
                Add Currency
              </Button>
            )}
          </div>

          {currency.length === 0 ? (
            <div className="text-center py-8 text-content-secondary">
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
