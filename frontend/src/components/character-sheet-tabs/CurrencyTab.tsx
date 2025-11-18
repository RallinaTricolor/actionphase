import { CharacterSheetTab } from './CharacterSheetTab';
import { CurrencyForm, type CurrencyFormData } from '../character-updates/CurrencyForm';
import type { DraftCharacterUpdate } from '../../types/phases';

interface CurrencyTabProps {
  gameId: number;
  actionResultId: number;
  characterId: number;
  drafts: DraftCharacterUpdate[];
  onDeleteDraft: (draftId: number) => void;
}

// Wrapper component to adapt CurrencyForm to CustomFormComponentProps
const CurrencyFormWrapper: React.FC<{
  onSubmit: (data: Record<string, unknown>) => void;
  onCancel: () => void;
  submitButtonTestId?: string;
}> = ({ onSubmit, ...props }) => (
  <CurrencyForm
    {...props}
    onSubmit={(data) => onSubmit(data as unknown as Record<string, unknown>)}
  />
);

export const CurrencyTab: React.FC<CurrencyTabProps> = (props) => {
  return (
    <CharacterSheetTab
      {...props}
      moduleType="currency"
      title="Currency Adjustments"
      addButtonLabel="Apply Change"
      emptyMessage="No pending currency changes"
      customFormComponent={CurrencyFormWrapper}
      transformCustomData={(data: Record<string, unknown>) => {
        const typedData = data as unknown as CurrencyFormData;
        const currencyEntry = {
          type: typedData.type,
          amount: typedData.amount,
          description: typedData.description,
        };
        return {
          fieldName: typedData.type,
          fieldValue: JSON.stringify(currencyEntry),
          fieldType: 'json' as const,
        };
      }}
      renderDraftContent={(draft) => {
        try {
          const currencyData = JSON.parse(draft.field_value);
          const amount = currencyData.amount || 0;
          const isPositive = amount >= 0;
          return (
            <>
              <p className={`text-sm font-semibold mt-1 ${isPositive ? 'text-semantic-success' : 'text-semantic-danger'}`}>
                {amount}
              </p>
              {currencyData.description && (
                <p className="text-sm text-content-secondary mt-1 whitespace-pre-line">
                  {currencyData.description}
                </p>
              )}
            </>
          );
        } catch (_e) {
          // Fallback for old format (plain numbers)
          const amount = parseInt(draft.field_value, 10);
          const isPositive = amount >= 0;
          return (
            <p className={`text-sm font-semibold mt-1 ${isPositive ? 'text-semantic-success' : 'text-semantic-danger'}`}>
              {amount}
            </p>
          );
        }
      }}
    />
  );
};
