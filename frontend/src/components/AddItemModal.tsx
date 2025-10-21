import { useState } from 'react';
import type { InventoryItem } from '../types/characters';
import { Button, Input, Textarea } from './ui';

interface AddItemModalProps {
  onAdd: (item: Omit<InventoryItem, 'id'>) => void;
  onCancel: () => void;
}

export const AddItemModal: React.FC<AddItemModalProps> = ({ onAdd, onCancel }) => {
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
      <div className="surface-base rounded-lg p-6 w-full max-w-md">
        <h3 className="text-lg font-medium text-content-primary mb-4">Add New Item</h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            id="item-name"
            label="Item Name *"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Iron Sword, Health Potion"
            required
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              id="item-quantity"
              label="Quantity"
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
              min={1}
              required
            />
            <Input
              id="item-category"
              label="Category"
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Weapon, Armor, etc."
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              id="item-value"
              label="Value"
              type="number"
              value={value}
              onChange={(e) => setValue(parseInt(e.target.value) || '')}
              min={0}
              placeholder="0"
            />
            <Input
              id="item-weight"
              label="Weight"
              type="number"
              value={weight}
              onChange={(e) => setWeight(parseFloat(e.target.value) || '')}
              min={0}
              step={0.1}
              placeholder="0.0"
            />
          </div>

          <Textarea
            id="item-description"
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe this item..."
            rows={2}
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
              Add Item
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
