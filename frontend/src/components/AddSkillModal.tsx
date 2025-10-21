import { useState } from 'react';
import type { CharacterSkill } from '../types/characters';
import { Button, Input, Textarea } from './ui';

interface AddSkillModalProps {
  onAdd: (skill: Omit<CharacterSkill, 'id'>) => void;
  onCancel: () => void;
}

export const AddSkillModal: React.FC<AddSkillModalProps> = ({ onAdd, onCancel }) => {
  const [name, setName] = useState('');
  const [level, setLevel] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    onAdd({
      name: name.trim(),
      level: level.trim() || undefined,
      description: description.trim() || undefined,
      category: category.trim() || undefined
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="surface-base rounded-lg p-6 w-full max-w-md">
        <h3 className="text-lg font-medium text-content-primary mb-4">Add New Skill</h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            id="skill-name"
            label="Skill Name *"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Sword Fighting, Lockpicking"
            required
          />

          <Input
            id="skill-level"
            label="Level"
            type="text"
            value={level}
            onChange={(e) => setLevel(e.target.value)}
            placeholder="e.g., Expert, 5, Advanced"
          />

          <Input
            id="skill-category"
            label="Category"
            type="text"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="e.g., Combat, Social, Academic"
          />

          <Textarea
            id="skill-description"
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe this skill..."
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
              Add Skill
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
