import React, { useState } from 'react';
import type { CharacterAbility, CharacterSkill } from '../types/characters';
import { AbilityCard } from './AbilityCard';
import { SkillCard } from './SkillCard';
import { AddAbilityModal } from './AddAbilityModal';
import { AddSkillModal } from './AddSkillModal';
import { Button } from './ui';

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
      <div className="flex space-x-1 mb-6 border-b border-theme-default">
        <Button
          variant="ghost"
          onClick={() => setActiveTab('abilities')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'abilities'
              ? 'border-interactive-primary text-interactive-primary'
              : 'border-transparent text-content-secondary hover:text-content-primary'
          }`}
        >
          Abilities ({abilities.length})
        </Button>
        <Button
          variant="ghost"
          onClick={() => setActiveTab('skills')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'skills'
              ? 'border-interactive-primary text-interactive-primary'
              : 'border-transparent text-content-secondary hover:text-content-primary'
          }`}
        >
          Skills ({skills.length})
        </Button>
      </div>

      {/* Abilities Tab */}
      {activeTab === 'abilities' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-content-primary">Abilities</h3>
            {canEdit && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setShowAddAbility(true)}
              >
                Add Ability
              </Button>
            )}
          </div>

          {abilities.length === 0 ? (
            <div className="text-center py-8 text-content-secondary">
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
            <h3 className="text-lg font-medium text-content-primary">Skills</h3>
            {canEdit && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setShowAddSkill(true)}
              >
                Add Skill
              </Button>
            )}
          </div>

          {skills.length === 0 ? (
            <div className="text-center py-8 text-content-secondary">
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
