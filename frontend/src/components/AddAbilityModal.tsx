import { useState } from 'react';
import type { CharacterAbility } from '../types/characters';

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
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h3 className="text-lg font-medium mb-4">Add New Ability</h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="ability-name" className="block text-sm font-medium text-gray-700 mb-1">
              Ability Name *
            </label>
            <input
              id="ability-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., Last Stand, Fire Breath"
              required
            />
          </div>

          <div>
            <label htmlFor="ability-type" className="block text-sm font-medium text-gray-700 mb-1">
              Type
            </label>
            <select
              id="ability-type"
              value={type}
              onChange={(e) => setType(e.target.value as CharacterAbility['type'])}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="learned">Learned</option>
              <option value="innate">Innate</option>
            </select>
          </div>

          <div>
            <label htmlFor="ability-description" className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              id="ability-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Describe what this ability does..."
              rows={3}
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700"
            >
              Add Ability
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
