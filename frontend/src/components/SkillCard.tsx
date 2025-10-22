import { useState } from 'react';
import type { CharacterSkill } from '../types/characters';
import { Button, Input, Textarea, Badge } from './ui';

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
    <div className="border border-theme-default rounded-lg p-5 surface-base hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          {isEditing ? (
            <div className="space-y-2">
              <Input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Skill name..."
                className="text-base font-medium"
              />
              <Input
                type="text"
                value={editLevel}
                onChange={(e) => setEditLevel(e.target.value)}
                placeholder="Level (e.g., Expert, 5, Advanced)"
                className="text-sm"
              />
            </div>
          ) : (
            <div>
              <h4 className="text-base font-semibold text-content-primary mb-1">{skill.name}</h4>
              {skill.level && (
                <span className="text-sm text-interactive-primary font-medium">Level: {skill.level}</span>
              )}
            </div>
          )}
        </div>

        {canEdit && (
          <div className="flex space-x-1 ml-4">
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

      {(skill.description || isEditing) && (
        <div className="mb-3">
          {isEditing ? (
            <Textarea
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              placeholder="Describe this skill..."
              rows={3}
            />
          ) : (
            <p className="text-sm text-content-primary leading-relaxed">{skill.description}</p>
          )}
        </div>
      )}

      {skill.category && (
        <Badge variant="primary" size="sm">
          {skill.category}
        </Badge>
      )}
    </div>
  );
};
