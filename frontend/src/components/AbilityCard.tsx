import { useState } from 'react';
import type { CharacterAbility } from '../types/characters';
import { Button, Input, Textarea, Badge } from './ui';
import { MarkdownPreview } from './MarkdownPreview';
import { CommentEditor } from './CommentEditor';

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

  const getTypeVariant = (type: CharacterAbility['type']): 'primary' | 'success' | 'warning' | 'neutral' => {
    switch (type) {
      case 'gm_assigned':
        return 'warning';
      case 'learned':
        return 'primary';
      case 'innate':
        return 'success';
      default:
        return 'neutral';
    }
  };

  return (
    <div className="border border-theme-default rounded-lg p-5 surface-base hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          {isEditing ? (
            <Input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="Ability name..."
              className="text-base font-medium"
            />
          ) : (
            <h4 className="text-base font-semibold text-content-primary mb-1">{ability.name}</h4>
          )}
        </div>

        <div className="flex items-center space-x-2 ml-4">
          <Badge variant={getTypeVariant(ability.type)} size="md">
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
        <div className="mb-3">
          {isEditing ? (
            <CommentEditor
              value={editDescription}
              onChange={setEditDescription}
              placeholder="Describe this ability... (Markdown supported)"
              rows={3}
              showPreviewByDefault={false}
            />
          ) : (
            <div className="text-sm">
              <MarkdownPreview content={ability.description || ''} />
            </div>
          )}
        </div>
      )}

      <div className="flex items-center gap-3 text-xs text-content-tertiary">
        {ability.source && (
          <span className="flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Source: {ability.source}
          </span>
        )}
        {!ability.active && (
          <Badge variant="neutral" size="sm">Inactive</Badge>
        )}
      </div>
    </div>
  );
};
