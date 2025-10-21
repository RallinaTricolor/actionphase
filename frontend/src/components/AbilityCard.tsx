import { useState } from 'react';
import type { CharacterAbility } from '../types/characters';
import { Button, Input, Textarea, Badge } from './ui';

interface AbilityCardProps {
  ability: CharacterAbility;
  canEdit: boolean;
  onUpdate: (updates: Partial<CharacterAbility>) => void;
  onRemove: () => void;
}

export const AbilityCard: React.FC<AbilityCardProps> = ({ ability, canEdit, onUpdate, onRemove }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(ability.name);
  const [editDescription, setEditDescription] = useState(ability.description || '');

  const handleSave = () => {
    onUpdate({
      name: editName,
      description: editDescription || undefined
    });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditName(ability.name);
    setEditDescription(ability.description || '');
    setIsEditing(false);
  };

  const getTypeVariant = (type: CharacterAbility['type']): 'primary' | 'success' | 'warning' | 'default' => {
    switch (type) {
      case 'gm_assigned':
        return 'warning';
      case 'learned':
        return 'primary';
      case 'innate':
        return 'success';
      default:
        return 'default';
    }
  };

  return (
    <div className="border border-theme-default rounded-lg p-4 surface-base">
      <div className="flex justify-between items-start mb-2">
        <div className="flex-1">
          {isEditing ? (
            <Input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="Ability name..."
              className="text-lg font-medium"
            />
          ) : (
            <h4 className="text-lg font-medium text-content-primary">{ability.name}</h4>
          )}
        </div>

        <div className="flex items-center space-x-2 ml-4">
          <Badge variant={getTypeVariant(ability.type)}>
            {ability.type.replace('_', ' ')}
          </Badge>

          {canEdit && ability.type !== 'gm_assigned' && (
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

      {(ability.description || isEditing) && (
        <div className="mb-2">
          {isEditing ? (
            <Textarea
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              placeholder="Describe this ability..."
              rows={2}
            />
          ) : (
            <p className="text-sm text-content-secondary">{ability.description}</p>
          )}
        </div>
      )}

      {ability.source && (
        <p className="text-xs text-content-tertiary">
          Source: {ability.source}
        </p>
      )}

      {!ability.active && (
        <div className="mt-2">
          <Badge variant="default">Inactive</Badge>
        </div>
      )}
    </div>
  );
};
