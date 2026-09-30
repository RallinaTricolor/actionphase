import { useId, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button, Select } from '@/components/ui';
import { useOptionalGameContext } from '@/contexts/GameContext';
import { apiClient } from '@/lib/api';
import { logger } from '@/services/LoggingService';
import type { CharacterSheetField } from '@/types/characters';
import type { LootTableContent } from '@/types/games';
import type { EntryEdit } from '@/lib/sheetEntries';
import type { LootMode } from '@/hooks/useLootRoll';
import { EntryForm } from './EntryForm';
import { LootTableSelector } from './LootTableSelector';
import { lootDataToEdit } from './fieldTypes';

interface LootModeFormProps {
  fields: readonly CharacterSheetField[];
  /** The modes the caller can act on. The loot modes also need a game with loot tables. */
  lootModes: readonly LootMode[];
  onAdd: (edit: EntryEdit) => void;
  /** Called with the chosen table in 'loot_table_random' mode; the server picks the entry. */
  onAddRandom?: (lootTableId: number) => void;
  onCancel: () => void;
}

/**
 * EntryForm plus a mode picker, for adding an entry that may come from a loot
 * table: typed in by hand, picked from a table, or rolled on one.
 *
 * Kept apart from EntryForm, which is also the edit form: an existing entry
 * never comes from a loot table. It also keeps the loot table queries (GM-only
 * endpoints, which need React Query) out of every plain add.
 */
export function LootModeForm({ fields, lootModes, onAdd, onAddRandom, onCancel }: LootModeFormProps) {
  const id = useId();
  const gameContext = useOptionalGameContext();

  // Loot tables are game-scoped, so both a caller opt-in and a game are needed.
  const lootModesAllowed = {
    loot_table: !!gameContext?.gameId && lootModes.includes('loot_table'),
    loot_table_random: !!gameContext?.gameId && lootModes.includes('loot_table_random') && !!onAddRandom,
  };

  const { data: lootTables, isLoading } = useQuery({
    queryKey: ['lootTables', gameContext?.gameId, true],
    queryFn: () => apiClient.games.getLootTables(gameContext!.gameId, true).then((res) => res.data),
    enabled: !!gameContext?.gameId && (lootModesAllowed.loot_table || lootModesAllowed.loot_table_random),
    // Always refetch on mount. The global default holds a list for five
    // minutes, and this form is usually mounted long after that list was first
    // fetched, so a GM who created a loot table and then opened a sheet was
    // served the pre-creation list and saw no loot modes until a reload.
    // Invalidation can't cover it: the table is created while this form is
    // unmounted, or in another tab, or by a co-GM.
    staleTime: 0,
    refetchOnMount: 'always',
  });

  // Derived, not state: a mode that latched off when one fetch found no tables
  // could never come back on, and it also disabled the fetch that would have.
  const hasLootTables = (lootTables?.length ?? 0) > 0;
  const enabled: Record<LootMode, boolean> = {
    manual: true,
    loot_table: lootModesAllowed.loot_table && hasLootTables,
    loot_table_random: lootModesAllowed.loot_table_random && hasLootTables,
  };

  const [mode, setMode] = useState<LootMode>('manual');
  const [lootTableId, setLootTableId] = useState<number | null>(null);
  const [selectedItem, setSelectedItem] = useState<LootTableContent | null>(null);

  // A mode withdrawn mid-edit (the tables went away) falls back to manual
  // rather than submitting through a picker that is no longer shown.
  const effectiveMode: LootMode = enabled[mode] ? mode : 'manual';

  if (isLoading) {
    return (
      <div className="surface-base rounded-lg border border-theme-default p-6">
        <div className="animate-pulse">
          <div className="h-6 surface-sunken rounded mb-4 w-1/3"></div>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 surface-sunken rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const submitLoot = (e: React.FormEvent) => {
    e.preventDefault();
    if (effectiveMode === 'loot_table_random') {
      if (lootTableId) onAddRandom?.(lootTableId);
      return;
    }
    if (!selectedItem) return;
    let data: unknown;
    try {
      data = JSON.parse(selectedItem.data);
    } catch {
      data = undefined;
    }
    if (typeof data !== 'object' || data === null || Array.isArray(data)) {
      // GM-authored free text, so it can be malformed; don't throw mid-submit.
      logger.error('Loot table item data is not a JSON object', { itemName: selectedItem.name });
      return;
    }
    onAdd(lootDataToEdit(fields, selectedItem.name, data as Record<string, unknown>));
  };

  return (
    <div className="space-y-4">
      {(enabled.loot_table || enabled.loot_table_random) && (
        <Select id={`${id}-mode`} label="Mode" value={effectiveMode} onChange={(e) => setMode(e.target.value as LootMode)}>
          <option value="manual">Manual</option>
          {enabled.loot_table && <option value="loot_table">Loot Table</option>}
          {enabled.loot_table_random && <option value="loot_table_random">Loot Table (Random)</option>}
        </Select>
      )}

      {/* Hidden rather than unmounted, so a half-typed manual entry survives a
          look at the loot tables. */}
      <div hidden={effectiveMode !== 'manual'}>
        <EntryForm fields={fields} onSubmit={onAdd} onCancel={onCancel} submitLabel="Add" variant="modal" />
      </div>

      {effectiveMode !== 'manual' && (
        <form onSubmit={submitLoot} className="space-y-4">
          <LootTableSelector
            gameId={gameContext!.gameId}
            lootTables={lootTables!}
            requireItem={effectiveMode === 'loot_table'}
            lootTableId={lootTableId}
            onLootTableChange={(tableId) => {
              setLootTableId(tableId);
              setSelectedItem(null);
            }}
            onItemChange={setSelectedItem}
          />
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Add
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
