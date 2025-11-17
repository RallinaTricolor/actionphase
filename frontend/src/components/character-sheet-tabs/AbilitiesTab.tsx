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

// Wrapper component to adapt AbilityForm to CustomFormComponentProps
const AbilityFormWrapper: React.FC<{
  onSubmit: (data: Record<string, unknown>) => void;
  onCancel: () => void;
  submitButtonTestId?: string;
}> = ({ onSubmit, ...props }) => (
  <AbilityForm
    {...props}
    onSubmit={(data) => onSubmit(data as unknown as Record<string, unknown>)}
  />
);

export const AbilitiesTab: React.FC<AbilitiesTabProps> = (props) => {
  return (
    <CharacterSheetTab
      {...props}
      moduleType="abilities"
      title="Abilities"
      addButtonLabel="+ Add Ability"
      emptyMessage="No pending ability changes"
      customFormComponent={AbilityFormWrapper}
      transformCustomData={(data: Record<string, unknown>) => {
        const typedData = data as unknown as AbilityFormData;
        const abilityData = {
          id: crypto.randomUUID(), // Generate unique ID
          name: typedData.name,
          type: typedData.type,
          description: typedData.description,
          active: true, // New abilities are active by default
        };
        return {
          fieldName: typedData.name,
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
