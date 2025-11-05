import { CharacterSheetTab } from './CharacterSheetTab';
import type { DraftCharacterUpdate } from '../../types/phases';

interface SkillsTabProps {
  gameId: number;
  actionResultId: number;
  characterId: number;
  drafts: DraftCharacterUpdate[];
  onDeleteDraft: (draftId: number) => void;
}

type ProficiencyLevel = 'Trained' | 'Expert' | 'Master' | 'Legendary';

interface SkillData {
  level: ProficiencyLevel;
  bonus: number;
}

export const SkillsTab: React.FC<SkillsTabProps> = (props) => {
  return (
    <CharacterSheetTab
      {...props}
      moduleType="skills"
      title="Skills"
      addButtonLabel="+ Add Skill"
      emptyMessage="No pending skill changes"
      formFields={[
        {
          name: 'skillName',
          label: 'Skill Name',
          type: 'text',
          placeholder: 'e.g., Lockpicking, Persuasion',
          required: true,
        },
        {
          name: 'proficiencyLevel',
          label: 'Proficiency Level',
          type: 'select',
          gridColumn: 'half',
          options: [
            { value: 'Trained', label: 'Trained' },
            { value: 'Expert', label: 'Expert' },
            { value: 'Master', label: 'Master' },
            { value: 'Legendary', label: 'Legendary' },
          ],
        },
        {
          name: 'bonus',
          label: 'Bonus',
          type: 'number',
          placeholder: '0',
          gridColumn: 'half',
        },
      ]}
      buildFieldName={(formData) => formData.skillName.trim()}
      buildFieldValue={(formData) => {
        const skillData: SkillData = {
          level: formData.proficiencyLevel || 'Trained',
          bonus: parseInt(formData.bonus, 10) || 0,
        };
        return JSON.stringify(skillData);
      }}
      getFieldType={() => 'json'}
      renderDraftContent={(draft) => {
        const skillData: SkillData = JSON.parse(draft.field_value);
        return (
          <div className="flex items-center gap-3 mt-1 text-sm text-content-secondary">
            <span className="font-semibold">{skillData.level}</span>
            <span>•</span>
            <span>Bonus: {skillData.bonus >= 0 ? '+' : ''}{skillData.bonus}</span>
          </div>
        );
      }}
    />
  );
};
