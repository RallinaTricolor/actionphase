import React, { useState } from 'react';
import type { CharacterAbility, CharacterSkill } from '../types/characters';
import { AbilityCard } from './AbilityCard';
import { SkillCard } from './SkillCard';
import { AddAbilityModal } from './AddAbilityModal';
import { AddSkillModal } from './AddSkillModal';

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
