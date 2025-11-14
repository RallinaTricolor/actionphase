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

export const InventoryTab: React.FC<InventoryTabProps> = (props) => {
  return (
    <CharacterSheetTab
      {...props}
      moduleType="inventory"
      title="Inventory"
      addButtonLabel="+ Add Item"
      emptyMessage="No pending inventory changes"
      customFormComponent={ItemForm}
      transformCustomData={(data: ItemFormData) => {
        const itemData = {
          id: crypto.randomUUID(), // Generate unique ID
          name: data.name,
          description: data.description,
          quantity: data.quantity,
          category: data.category,
          value: data.value,
          weight: data.weight,
          equipped: false, // Default for new items
        };
        return {
          fieldName: data.name,
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
