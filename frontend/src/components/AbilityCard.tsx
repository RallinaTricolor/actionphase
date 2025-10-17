import { useState } from 'react';
import type { CharacterAbility } from '../types/characters';

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

  const getTypeColor = (type: CharacterAbility['type']) => {
    switch (type) {
      case 'gm_assigned':
        return 'bg-purple-100 text-purple-800';
      case 'learned':
        return 'bg-blue-100 text-blue-800';
      case 'innate':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-white">
      <div className="flex justify-between items-start mb-2">
        <div className="flex-1">
          {isEditing ? (
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="text-lg font-medium border-b border-gray-300 focus:border-blue-500 focus:outline-none bg-transparent"
              placeholder="Ability name..."
            />
          ) : (
            <h4 className="text-lg font-medium text-gray-900">{ability.name}</h4>
          )}
        </div>

        <div className="flex items-center space-x-2 ml-4">
          <span className={`px-2 py-1 text-xs font-medium rounded-full ${getTypeColor(ability.type)}`}>
            {ability.type.replace('_', ' ')}
          </span>

          {canEdit && ability.type !== 'gm_assigned' && (
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

      {(ability.description || isEditing) && (
        <div className="mb-2">
          {isEditing ? (
            <textarea
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              className="w-full text-sm text-gray-600 border border-gray-300 rounded p-2 focus:border-blue-500 focus:outline-none"
              placeholder="Describe this ability..."
              rows={2}
            />
          ) : (
            <p className="text-sm text-gray-600">{ability.description}</p>
          )}
        </div>
      )}

      {ability.source && (
        <p className="text-xs text-gray-500">
          Source: {ability.source}
        </p>
      )}

      {!ability.active && (
        <div className="mt-2">
          <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded">Inactive</span>
        </div>
      )}
    </div>
  );
};
