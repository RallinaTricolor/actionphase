import { useState } from 'react';
import type { CharacterSkill } from '../types/characters';

interface SkillCardProps {
  skill: CharacterSkill;
  canEdit: boolean;
  onUpdate: (updates: Partial<CharacterSkill>) => void;
  onRemove: () => void;
}

export const SkillCard: React.FC<SkillCardProps> = ({ skill, canEdit, onUpdate, onRemove }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(skill.name);
  const [editLevel, setEditLevel] = useState(skill.level?.toString() || '');
  const [editDescription, setEditDescription] = useState(skill.description || '');

  const handleSave = () => {
    onUpdate({
      name: editName,
      level: editLevel || undefined,
      description: editDescription || undefined
    });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditName(skill.name);
    setEditLevel(skill.level?.toString() || '');
    setEditDescription(skill.description || '');
    setIsEditing(false);
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
                placeholder="Skill name..."
              />
              <input
                type="text"
                value={editLevel}
                onChange={(e) => setEditLevel(e.target.value)}
                className="text-sm border border-gray-300 rounded px-2 py-1 focus:border-blue-500 focus:outline-none"
                placeholder="Level (e.g., Expert, 5, Advanced)"
              />
            </div>
          ) : (
            <div>
              <h4 className="text-lg font-medium text-gray-900">{skill.name}</h4>
              {skill.level && (
                <span className="text-sm text-blue-600 font-medium">Level: {skill.level}</span>
              )}
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

      {(skill.description || isEditing) && (
        <div className="mb-2">
          {isEditing ? (
            <textarea
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              className="w-full text-sm text-gray-600 border border-gray-300 rounded p-2 focus:border-blue-500 focus:outline-none"
              placeholder="Describe this skill..."
              rows={2}
            />
          ) : (
            <p className="text-sm text-gray-600">{skill.description}</p>
          )}
        </div>
      )}

      {skill.category && (
        <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded">
          {skill.category}
        </span>
      )}
    </div>
  );
};
