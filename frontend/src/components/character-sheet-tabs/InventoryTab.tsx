import { CharacterSheetTab } from './CharacterSheetTab';
import type { DraftCharacterUpdate } from '../../types/phases';

interface InventoryTabProps {
  gameId: number;
  actionResultId: number;
  characterId: number;
  drafts: DraftCharacterUpdate[];
  onDeleteDraft: (draftId: number) => void;
}

interface ItemData {
  name: string;
  description?: string;
  quantity: number;
}

export const InventoryTab: React.FC<InventoryTabProps> = (props) => {
  return (
    <CharacterSheetTab
      {...props}
      moduleType="inventory"
      title="Inventory"
      addButtonLabel="+ Add Item"
      emptyMessage="No pending inventory changes"
      formFields={[
        {
          name: 'itemName',
          label: 'Item Name',
          type: 'text',
          placeholder: 'e.g., Healing Potion, Rope',
          required: true,
        },
        {
          name: 'itemDescription',
          label: 'Description',
          type: 'textarea',
          placeholder: 'Describe this item...',
          rows: 2,
        },
        {
          name: 'quantity',
          label: 'Quantity',
          type: 'number',
          placeholder: '1',
        },
      ]}
      buildFieldName={(formData) => formData.itemName.trim()}
      buildFieldValue={(formData) => {
        const itemData: ItemData = {
          name: formData.itemName.trim(),
          description: formData.itemDescription?.trim() || undefined,
          quantity: parseInt(formData.quantity, 10) || 1,
        };
        return JSON.stringify(itemData);
      }}
      getFieldType={() => 'json'}
      renderDraftContent={(draft) => {
        const itemData: ItemData = JSON.parse(draft.field_value);
        return (
          <>
            {itemData.description && (
              <p className="text-sm text-content-secondary mt-1">
                {itemData.description}
              </p>
            )}
            <p className="text-sm text-content-secondary mt-1">
              Quantity: {itemData.quantity}
            </p>
          </>
        );
      }}
    />
  );
};
