import { useState } from 'react';
import type { CharacterSkill } from '../types/characters';

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
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h3 className="text-lg font-medium mb-4">Add New Skill</h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="skill-name" className="block text-sm font-medium text-gray-700 mb-1">
              Skill Name *
            </label>
            <input
              id="skill-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., Sword Fighting, Lockpicking"
              required
            />
          </div>

          <div>
            <label htmlFor="skill-level" className="block text-sm font-medium text-gray-700 mb-1">
              Level
            </label>
            <input
              id="skill-level"
              type="text"
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., Expert, 5, Advanced"
            />
          </div>

          <div>
            <label htmlFor="skill-category" className="block text-sm font-medium text-gray-700 mb-1">
              Category
            </label>
            <input
              id="skill-category"
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., Combat, Social, Academic"
            />
          </div>

          <div>
            <label htmlFor="skill-description" className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              id="skill-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Describe this skill..."
              rows={2}
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
              Add Skill
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
