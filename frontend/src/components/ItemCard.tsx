import { useState } from 'react';
import type { InventoryItem } from '../types/characters';
import { Button, Input, Textarea, Badge } from './ui';

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

  const getCategoryVariant = (category?: string): 'primary' | 'success' | 'warning' | 'danger' | 'default' => {
    if (!category) return 'default';

    switch (category.toLowerCase()) {
      case 'weapon':
        return 'danger';
      case 'armor':
        return 'primary';
      case 'consumable':
        return 'success';
      case 'tool':
        return 'warning';
      default:
        return 'default';
    }
  };

  return (
    <div className="border border-theme-default rounded-lg p-4 surface-base">
      <div className="flex justify-between items-start mb-2">
        <div className="flex-1">
          {isEditing ? (
            <div className="space-y-2">
              <Input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Item name..."
                className="text-lg font-medium"
              />
              <div className="flex items-center space-x-2">
                <span className="text-sm text-content-secondary">Qty:</span>
                <Input
                  type="number"
                  value={editQuantity}
                  onChange={(e) => setEditQuantity(parseInt(e.target.value) || 1)}
                  className="w-20 text-sm"
                  min="1"
                />
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-center space-x-2">
                <h4 className="text-lg font-medium text-content-primary">{item.name}</h4>
                {item.quantity > 1 && (
                  <Badge variant="default">
                    x{item.quantity}
                  </Badge>
                )}
                {item.equipped && (
                  <Badge variant="success">
                    Equipped
                  </Badge>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center space-x-2 ml-4">
          {item.category && (
            <Badge variant={getCategoryVariant(item.category)}>
              {item.category}
            </Badge>
          )}

          {canEdit && (
            <div className="flex space-x-1">
              {isEditing ? (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleSave}
                    className="p-1 text-semantic-success hover:text-semantic-success"
                  >
                    ✓
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCancel}
                    className="p-1 text-content-secondary hover:text-content-primary"
                  >
                    ✕
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsEditing(true)}
                    className="p-1 text-interactive-primary hover:text-interactive-primary-hover"
                  >
                    ✎
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onRemove}
                    className="p-1 text-semantic-danger hover:text-semantic-danger"
                  >
                    🗑
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {(item.description || isEditing) && (
        <div className="mb-2">
          {isEditing ? (
            <Textarea
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              placeholder="Describe this item..."
              rows={2}
            />
          ) : (
            <p className="text-sm text-content-secondary">{item.description}</p>
          )}
        </div>
      )}

      {/* Item Stats */}
      <div className="flex flex-wrap gap-4 text-xs text-content-tertiary">
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
