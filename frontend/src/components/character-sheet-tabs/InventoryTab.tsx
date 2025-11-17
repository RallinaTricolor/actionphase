import { CharacterSheetTab } from './CharacterSheetTab';
import { ItemForm, type ItemFormData } from '../character-updates/ItemForm';
import type { DraftCharacterUpdate } from '../../types/phases';
import { Badge } from '../ui';

interface InventoryTabProps {
  gameId: number;
  actionResultId: number;
  characterId: number;
  drafts: DraftCharacterUpdate[];
  onDeleteDraft: (draftId: number) => void;
}

// Wrapper component to adapt ItemForm to CustomFormComponentProps
const ItemFormWrapper: React.FC<{
  onSubmit: (data: Record<string, unknown>) => void;
  onCancel: () => void;
  submitButtonTestId?: string;
}> = ({ onSubmit, ...props }) => (
  <ItemForm
    {...props}
    onSubmit={(data) => onSubmit(data as unknown as Record<string, unknown>)}
  />
);

export const InventoryTab: React.FC<InventoryTabProps> = (props) => {
  return (
    <CharacterSheetTab
      {...props}
      moduleType="inventory"
      title="Inventory"
      addButtonLabel="+ Add Item"
      emptyMessage="No pending inventory changes"
      customFormComponent={ItemFormWrapper}
      transformCustomData={(data: Record<string, unknown>) => {
        const typedData = data as unknown as ItemFormData;
        const itemData = {
          id: crypto.randomUUID(), // Generate unique ID
          name: typedData.name,
          description: typedData.description,
          quantity: typedData.quantity,
          category: typedData.category,
          value: typedData.value,
          weight: typedData.weight,
          equipped: false, // Default for new items
        };
        return {
          fieldName: typedData.name,
          fieldValue: JSON.stringify(itemData),
          fieldType: 'json' as const,
        };
      }}
      renderDraftContent={(draft) => {
        try {
          const itemData = JSON.parse(draft.field_value);
          return (
            <>
              {itemData.category && (
                <Badge variant="primary" className="text-xs mt-1">
                  {itemData.category}
                </Badge>
              )}
              {itemData.description && (
                <p className="text-sm text-content-secondary mt-1 whitespace-pre-line">
                  {itemData.description}
                </p>
              )}
              <div className="flex gap-3 text-xs text-content-secondary mt-1">
                <span>Qty: {itemData.quantity}</span>
                {itemData.value !== undefined && <span>Value: {itemData.value}</span>}
                {itemData.weight !== undefined && <span>Weight: {itemData.weight}</span>}
              </div>
            </>
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
