import { CharacterSheetTab } from './CharacterSheetTab';
import type { DraftCharacterUpdate } from '../../types/phases';

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
      formFields={[
        {
          name: 'abilityName',
          label: 'Ability Name',
          type: 'text',
          placeholder: 'e.g., Fireball, Sneak Attack',
          required: true,
        },
        {
          name: 'abilityDescription',
          label: 'Description',
          type: 'textarea',
          placeholder: 'Describe this ability...',
          rows: 3,
        },
      ]}
      buildFieldName={(formData) => formData.abilityName.trim()}
      buildFieldValue={(formData) => {
        const abilityData = {
          name: formData.abilityName.trim(),
          description: formData.abilityDescription.trim(),
        };
        return JSON.stringify(abilityData);
      }}
      getFieldType={() => 'json'}
      renderDraftContent={(draft) => {
        try {
          const abilityData = JSON.parse(draft.field_value);
          return (
            <p className="text-sm text-content-secondary mt-1">
              {abilityData.description}
            </p>
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
