import { CharacterSheetTab } from './CharacterSheetTab';
import { AbilityForm, type AbilityFormData } from '../character-updates/AbilityForm';
import type { DraftCharacterUpdate } from '../../types/phases';
import { Badge } from '../ui';

interface AbilitiesTabProps {
  gameId: number;
  actionResultId: number;
  characterId: number;
  drafts: DraftCharacterUpdate[];
  onDeleteDraft: (draftId: number) => void;
}

export const AbilitiesTab: React.FC<AbilitiesTabProps> = (props) => {
  return (
    <CharacterSheetTab
      {...props}
      moduleType="abilities"
      title="Abilities"
      addButtonLabel="+ Add Ability"
      emptyMessage="No pending ability changes"
      customFormComponent={AbilityForm}
      transformCustomData={(data: AbilityFormData) => {
        const abilityData = {
          name: data.name,
          type: data.type,
          description: data.description,
        };
        return {
          fieldName: data.name,
          fieldValue: JSON.stringify(abilityData),
          fieldType: 'json' as const,
        };
      }}
      renderDraftContent={(draft) => {
        try {
          const abilityData = JSON.parse(draft.field_value);
          return (
            <div className="mt-1 space-y-1">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">
                  {abilityData.type === 'learned' ? 'Learned' : 'Innate'}
                </Badge>
              </div>
              {abilityData.description && (
                <p className="text-sm text-content-secondary">
                  {abilityData.description}
                </p>
              )}
            </div>
          );
        } catch {
          // Fallback for legacy text format
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
