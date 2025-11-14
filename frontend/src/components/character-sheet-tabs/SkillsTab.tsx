import { CharacterSheetTab } from './CharacterSheetTab';
import { SkillForm, type SkillFormData } from '../character-updates/SkillForm';
import type { DraftCharacterUpdate } from '../../types/phases';
import { Badge } from '../ui';

interface SkillsTabProps {
  gameId: number;
  actionResultId: number;
  characterId: number;
  drafts: DraftCharacterUpdate[];
  onDeleteDraft: (draftId: number) => void;
}

export const SkillsTab: React.FC<SkillsTabProps> = (props) => {
  return (
    <CharacterSheetTab
      {...props}
      moduleType="skills"
      title="Skills"
      addButtonLabel="+ Add Skill"
      emptyMessage="No pending skill changes"
      customFormComponent={SkillForm}
      transformCustomData={(data: SkillFormData) => {
        const skillData = {
          id: crypto.randomUUID(), // Generate unique ID
          name: data.name,
          level: data.level,
          description: data.description,
          category: data.category,
        };
        return {
          fieldName: data.name,
          fieldValue: JSON.stringify(skillData),
          fieldType: 'json' as const,
        };
      }}
      renderDraftContent={(draft) => {
        try {
          const skillData = JSON.parse(draft.field_value);
          return (
            <div className="mt-1 space-y-1">
              {skillData.level && (
                <p className="text-sm text-content-secondary">
                  Level: {skillData.level}
                </p>
              )}
              {skillData.category && (
                <Badge variant="primary" className="text-xs">
                  {skillData.category}
                </Badge>
              )}
              {skillData.description && (
                <p className="text-sm text-content-secondary whitespace-pre-line">
                  {skillData.description}
                </p>
              )}
            </div>
          );
        } catch {
          // Fallback for legacy format
          return (
            <p className="text-sm text-content-secondary mt-1">
              {draft.field_value}
            </p>
          );
        }
      }}
    />
  );
};
