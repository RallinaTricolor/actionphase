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
    <div className="border border-theme-default rounded-lg p-5 surface-base hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          {isEditing ? (
            <div className="space-y-2">
              <Input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Item name..."
                className="text-base font-medium"
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
              <div className="flex items-center space-x-2 flex-wrap gap-1">
                <h4 className="text-base font-semibold text-content-primary">{item.name}</h4>
                {item.quantity > 1 && (
                  <Badge variant="default" size="sm">
                    x{item.quantity}
                  </Badge>
                )}
                {item.equipped && (
                  <Badge variant="success" size="sm">
                    Equipped
                  </Badge>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center space-x-2 ml-4">
          {item.category && (
            <Badge variant={getCategoryVariant(item.category)} size="md">
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
        <div className="mb-3">
          {isEditing ? (
            <Textarea
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              placeholder="Describe this item..."
              rows={3}
            />
          ) : (
            <p className="text-sm text-content-primary leading-relaxed">{item.description}</p>
          )}
        </div>
      )}

      {/* Item Stats */}
      {(item.weight || item.value || item.condition) && (
        <div className="flex flex-wrap gap-3 text-xs text-content-secondary border-t border-theme-default pt-3">
          {item.weight !== undefined && (
            <span className="flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
              </svg>
              Weight: {(item.weight * item.quantity).toFixed(1)}
            </span>
          )}
          {item.value !== undefined && (
            <span className="flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Value: {item.value * item.quantity}
            </span>
          )}
          {item.condition && (
            <span className="flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {item.condition}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
