import React, { useState } from 'react';
import type { CharacterAbility, CharacterSkill } from '../types/characters';

interface AbilitiesManagerProps {
  abilities: CharacterAbility[];
  skills: CharacterSkill[];
  canEdit: boolean;
  onAbilitiesChange: (abilities: CharacterAbility[]) => void;
  onSkillsChange: (skills: CharacterSkill[]) => void;
}

export const AbilitiesManager: React.FC<AbilitiesManagerProps> = ({
  abilities,
  skills,
  canEdit,
  onAbilitiesChange,
  onSkillsChange
}) => {
  const [activeTab, setActiveTab] = useState<'abilities' | 'skills'>('abilities');
  const [showAddAbility, setShowAddAbility] = useState(false);
  const [showAddSkill, setShowAddSkill] = useState(false);

  const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const addAbility = (abilityData: Omit<CharacterAbility, 'id'>) => {
    const newAbility: CharacterAbility = {
      id: generateId(),
      ...abilityData
    };
    onAbilitiesChange([...abilities, newAbility]);
    setShowAddAbility(false);
  };

  const addSkill = (skillData: Omit<CharacterSkill, 'id'>) => {
    const newSkill: CharacterSkill = {
      id: generateId(),
      ...skillData
    };
    onSkillsChange([...skills, newSkill]);
    setShowAddSkill(false);
  };

  const removeAbility = (id: string) => {
    onAbilitiesChange(abilities.filter(a => a.id !== id));
  };

  const removeSkill = (id: string) => {
    onSkillsChange(skills.filter(s => s.id !== id));
  };

  const updateAbility = (id: string, updates: Partial<CharacterAbility>) => {
    onAbilitiesChange(abilities.map(a => a.id === id ? { ...a, ...updates } : a));
  };

  const updateSkill = (id: string, updates: Partial<CharacterSkill>) => {
    onSkillsChange(skills.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  return (
    <div>
      {/* Tab Navigation */}
      <div className="flex space-x-1 mb-6 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('abilities')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'abilities'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Abilities ({abilities.length})
        </button>
        <button
          onClick={() => setActiveTab('skills')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'skills'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Skills ({skills.length})
        </button>
      </div>

      {/* Abilities Tab */}
      {activeTab === 'abilities' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-gray-900">Abilities</h3>
            {canEdit && (
              <button
                onClick={() => setShowAddAbility(true)}
                className="px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Add Ability
              </button>
            )}
          </div>

          {abilities.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No abilities yet.</p>
              {canEdit && <p className="text-sm mt-1">Click "Add Ability" to get started.</p>}
            </div>
          ) : (
            <div className="space-y-3">
              {abilities.map((ability) => (
                <AbilityCard
                  key={ability.id}
                  ability={ability}
                  canEdit={canEdit}
                  onUpdate={(updates) => updateAbility(ability.id, updates)}
                  onRemove={() => removeAbility(ability.id)}
                />
              ))}
            </div>
          )}

          {showAddAbility && (
            <AddAbilityModal
              onAdd={addAbility}
              onCancel={() => setShowAddAbility(false)}
            />
          )}
        </div>
      )}

      {/* Skills Tab */}
      {activeTab === 'skills' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-gray-900">Skills</h3>
            {canEdit && (
              <button
                onClick={() => setShowAddSkill(true)}
                className="px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Add Skill
              </button>
            )}
          </div>

          {skills.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No skills yet.</p>
              {canEdit && <p className="text-sm mt-1">Click "Add Skill" to get started.</p>}
            </div>
          ) : (
            <div className="space-y-3">
              {skills.map((skill) => (
                <SkillCard
                  key={skill.id}
                  skill={skill}
                  canEdit={canEdit}
                  onUpdate={(updates) => updateSkill(skill.id, updates)}
                  onRemove={() => removeSkill(skill.id)}
                />
              ))}
            </div>
          )}

          {showAddSkill && (
            <AddSkillModal
              onAdd={addSkill}
              onCancel={() => setShowAddSkill(false)}
            />
          )}
        </div>
      )}
    </div>
  );
};

// Ability Card Component
interface AbilityCardProps {
  ability: CharacterAbility;
  canEdit: boolean;
  onUpdate: (updates: Partial<CharacterAbility>) => void;
  onRemove: () => void;
}

const AbilityCard: React.FC<AbilityCardProps> = ({ ability, canEdit, onUpdate, onRemove }) => {
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

// Skill Card Component (similar structure)
interface SkillCardProps {
  skill: CharacterSkill;
  canEdit: boolean;
  onUpdate: (updates: Partial<CharacterSkill>) => void;
  onRemove: () => void;
}

const SkillCard: React.FC<SkillCardProps> = ({ skill, canEdit, onUpdate, onRemove }) => {
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

// Add Ability Modal
interface AddAbilityModalProps {
  onAdd: (ability: Omit<CharacterAbility, 'id'>) => void;
  onCancel: () => void;
}

const AddAbilityModal: React.FC<AddAbilityModalProps> = ({ onAdd, onCancel }) => {
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
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Ability Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., Last Stand, Fire Breath"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Type
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as CharacterAbility['type'])}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="learned">Learned</option>
              <option value="innate">Innate</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
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

// Add Skill Modal
interface AddSkillModalProps {
  onAdd: (skill: Omit<CharacterSkill, 'id'>) => void;
  onCancel: () => void;
}

const AddSkillModal: React.FC<AddSkillModalProps> = ({ onAdd, onCancel }) => {
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
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Skill Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., Sword Fighting, Lockpicking"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Level
            </label>
            <input
              type="text"
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., Expert, 5, Advanced"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Category
            </label>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., Combat, Social, Academic"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
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
