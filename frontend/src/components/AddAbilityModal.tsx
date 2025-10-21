import { useState } from 'react';
import type { CharacterAbility } from '../types/characters';
import { Button, Input, Select, Textarea } from './ui';

interface AddAbilityModalProps {
  onAdd: (ability: Omit<CharacterAbility, 'id'>) => void;
  onCancel: () => void;
}

export const AddAbilityModal: React.FC<AddAbilityModalProps> = ({ onAdd, onCancel }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<CharacterAbility['type']>('learned');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    onAdd({
      name: name.trim(),
      description: description.trim() || undefined,
      type,
      active: true
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="surface-base rounded-lg p-6 w-full max-w-md">
        <h3 className="text-lg font-medium text-content-primary mb-4">Add New Ability</h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            id="ability-name"
            label="Ability Name *"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Last Stand, Fire Breath"
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
            placeholder="Describe what this ability does..."
            rows={3}
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
              Add Ability
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
