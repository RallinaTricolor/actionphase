import { useState } from 'react';
import type { CharacterSkill } from '../../types/characters';
import { Button, Input, Textarea } from '../ui';

export interface SkillFormData {
  name: string;
  level?: number | string;
  description?: string;
  category?: string;
}

interface SkillFormProps {
  onSubmit: (data: SkillFormData) => void;
  onCancel: () => void;
  initialValues?: Partial<SkillFormData>;
  submitLabel?: string;
  variant?: 'modal' | 'inline';
  submitButtonTestId?: string;
}

/**
 * Shared form component for adding/editing character skills.
 * Used in both AddSkillModal and SkillsTab to ensure consistency.
 */
export const SkillForm: React.FC<SkillFormProps> = ({
  onSubmit,
  onCancel,
  initialValues,
  submitLabel = 'Add Skill',
  variant = 'modal',
  submitButtonTestId,
}) => {
  const [name, setName] = useState(initialValues?.name || '');
  const [level, setLevel] = useState(initialValues?.level?.toString() || '');
  const [description, setDescription] = useState(initialValues?.description || '');
  const [category, setCategory] = useState(initialValues?.category || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    onSubmit({
      name: name.trim(),
      level: level.trim() || undefined,
      description: description.trim() || undefined,
      category: category.trim() || undefined,
    });
  };

  return (
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

      <div className={`flex justify-end gap-3 ${variant === 'modal' ? 'pt-4' : 'pt-2'}`}>
        <Button
          type="button"
          variant="secondary"
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          variant="primary"
          data-testid={submitButtonTestId}
        >
          {submitLabel}
        </Button>
      </div>
    </form>
  );
};
