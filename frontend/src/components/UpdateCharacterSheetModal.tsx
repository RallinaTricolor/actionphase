import { useState } from 'react';
import { Modal } from './Modal';
import { Button, Alert, Badge } from './ui';
import { useDraftCharacterUpdates, useDeleteDraftCharacterUpdate } from '../hooks';
import { AbilitiesTab } from './character-sheet-tabs/AbilitiesTab';
import { SkillsTab } from './character-sheet-tabs/SkillsTab';
import { InventoryTab } from './character-sheet-tabs/InventoryTab';
import { CurrencyTab } from './character-sheet-tabs/CurrencyTab';

interface UpdateCharacterSheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  gameId: number;
  actionResultId: number;
  characterId: number;
  characterName: string;
}

type TabType = 'abilities' | 'skills' | 'inventory' | 'currency';

export const UpdateCharacterSheetModal: React.FC<UpdateCharacterSheetModalProps> = ({
  isOpen,
  onClose,
  gameId,
  actionResultId,
  characterId,
  characterName,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('abilities');

  const { data: drafts, isLoading } = useDraftCharacterUpdates(gameId, actionResultId);
  const deleteDraft = useDeleteDraftCharacterUpdate(gameId, actionResultId);

  const draftCount = drafts?.length || 0;

  const abilitiesDrafts = drafts?.filter(d => d.module_type === 'abilities') || [];
  const skillsDrafts = drafts?.filter(d => d.module_type === 'skills') || [];
  const inventoryDrafts = drafts?.filter(d => d.module_type === 'inventory') || [];
  const currencyDrafts = drafts?.filter(d => d.module_type === 'currency') || [];

  const handleDeleteDraft = (draftId: number) => {
    deleteDraft.mutate(draftId);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-primary pb-4">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-semibold text-content-primary">
              Update Character Sheet
            </h2>
            {draftCount > 0 && (
              <Badge variant="warning">
                {draftCount} pending change{draftCount !== 1 ? 's' : ''}
              </Badge>
            )}
          </div>
          <div className="text-sm text-content-secondary">
            {characterName}
          </div>
        </div>

        {/* Info Alert */}
        <Alert variant="info">
          Changes will be published when you publish the action result.
        </Alert>

        {/* Tab Navigation */}
        <div className="border-b border-border-primary">
          <nav className="flex space-x-1" aria-label="Tabs">
            {[
              { id: 'abilities' as TabType, label: 'Abilities', count: abilitiesDrafts.length },
              { id: 'skills' as TabType, label: 'Skills', count: skillsDrafts.length },
              { id: 'inventory' as TabType, label: 'Inventory', count: inventoryDrafts.length },
              { id: 'currency' as TabType, label: 'Currency', count: currencyDrafts.length },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  px-4 py-2 text-sm font-medium rounded-t-lg transition-colors
                  ${activeTab === tab.id
                    ? 'bg-bg-primary text-interactive-primary border-b-2 border-interactive-primary'
                    : 'text-content-secondary hover:text-content-primary hover:bg-bg-secondary'
                  }
                `}
              >
                <span className="flex items-center gap-2">
                  {tab.label}
                  {tab.count > 0 && (
                    <Badge variant="primary" className="text-xs">
                      {tab.count}
                    </Badge>
                  )}
                </span>
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="min-h-[400px]">
          {activeTab === 'abilities' && (
            <AbilitiesTab
              gameId={gameId}
              actionResultId={actionResultId}
              characterId={characterId}
              drafts={abilitiesDrafts}
              onDeleteDraft={handleDeleteDraft}
            />
          )}

          {activeTab === 'skills' && (
            <SkillsTab
              gameId={gameId}
              actionResultId={actionResultId}
              characterId={characterId}
              drafts={skillsDrafts}
              onDeleteDraft={handleDeleteDraft}
            />
          )}

          {activeTab === 'inventory' && (
            <InventoryTab
              gameId={gameId}
              actionResultId={actionResultId}
              characterId={characterId}
              drafts={inventoryDrafts}
              onDeleteDraft={handleDeleteDraft}
            />
          )}

          {activeTab === 'currency' && (
            <CurrencyTab
              gameId={gameId}
              actionResultId={actionResultId}
              characterId={characterId}
              drafts={currencyDrafts}
              onDeleteDraft={handleDeleteDraft}
            />
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end border-t border-border-primary pt-4">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
};
