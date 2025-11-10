import { CharacterSheetTab } from './CharacterSheetTab';
import type { DraftCharacterUpdate } from '../../types/phases';

interface CurrencyTabProps {
  gameId: number;
  actionResultId: number;
  characterId: number;
  drafts: DraftCharacterUpdate[];
  onDeleteDraft: (draftId: number) => void;
}

export const CurrencyTab: React.FC<CurrencyTabProps> = (props) => {
  return (
    <CharacterSheetTab
      {...props}
      moduleType="currency"
      title="Currency Adjustments"
      addButtonLabel="Apply Change"
      emptyMessage="No pending currency changes"
      formFields={[
        {
          name: 'currencyType',
          label: 'Currency Type',
          type: 'text',
          placeholder: 'e.g., Gold, Silver, Copper',
          required: true,
          gridColumn: 'half',
        },
        {
          name: 'adjustment',
          label: 'New Amount',
          type: 'number',
          placeholder: 'e.g., 150',
          required: true,
          gridColumn: 'half',
        },
      ]}
      buildFieldName={(formData) => formData.currencyType.trim()}
      buildFieldValue={(formData) => {
        const amount = parseInt(formData.adjustment, 10);
        return isNaN(amount) ? '0' : amount.toString();
      }}
      getFieldType={() => 'number'}
      validateForm={(formData) => {
        const amount = parseInt(formData.adjustment, 10);
        if (isNaN(amount) || amount === 0) {
          return 'Please enter a non-zero amount';
        }
        return null;
      }}
      renderDraftContent={(draft) => {
        const amount = parseInt(draft.field_value, 10);
        const isPositive = amount >= 0;
        return (
          <p className={`text-sm font-semibold mt-1 ${isPositive ? 'text-semantic-success' : 'text-semantic-danger'}`}>
            {isPositive ? '+' : ''}{amount}
          </p>
        );
      }}
    />
  );
};
