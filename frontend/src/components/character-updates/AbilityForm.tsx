import { useState } from 'react';
import type { CharacterAbility } from '../../types/characters';
import { Button, Input, Select, Textarea } from '../ui';

export interface AbilityFormData {
  name: string;
  type: CharacterAbility['type'];
  description?: string;
}

interface AbilityFormProps {
  onSubmit: (data: AbilityFormData) => void;
  onCancel: () => void;
  initialValues?: Partial<AbilityFormData>;
  submitLabel?: string;
  variant?: 'modal' | 'inline';
  submitButtonTestId?: string;
}

/**
 * Shared form component for adding/editing character abilities.
 * Used in both AddAbilityModal and AbilitiesTab to ensure consistency.
 */
export const AbilityForm: React.FC<AbilityFormProps> = ({
  onSubmit,
  onCancel,
  initialValues,
  submitLabel = 'Add Ability',
  variant = 'modal',
  submitButtonTestId,
}) => {
  const [name, setName] = useState(initialValues?.name || '');
  const [description, setDescription] = useState(initialValues?.description || '');
  const [type, setType] = useState<CharacterAbility['type']>(initialValues?.type || 'learned');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    onSubmit({
      name: name.trim(),
      type,
      description: description.trim() || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        id="ability-name"
        label="Ability Name *"
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="e.g., Fireball, Sneak Attack"
        required
      />

      <Select
        id="ability-type"
        label="Type"
        value={type}
        onChange={(e) => setType(e.target.value as CharacterAbility['type'])}
      >
        <option value="learned">Learned</option>
        <option value="innate">Innate</option>
      </Select>

      <Textarea
        id="ability-description"
        label="Description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Describe this ability..."
        rows={3}
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
