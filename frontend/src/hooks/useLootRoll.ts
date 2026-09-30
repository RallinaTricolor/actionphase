import { useOptionalGameContext } from '@/contexts/GameContext';
import { useToast } from '@/contexts/ToastContext';
import { apiClient } from '@/lib/api';
import { extractApiErrorMessage } from '@/lib/errors';
import { logger } from '@/services/LoggingService';
import type { RawSheetEntry } from '@/lib/sheetEntries';

/**
 * How an entry can be added: typed in by hand, picked from a loot table, or
 * rolled at random on one.
 */
export type LootMode = 'manual' | 'loot_table' | 'loot_table_random';

export interface LootRolling {
  /** The add modes on offer. Only 'manual' outside a game. */
  modes: LootMode[];
  /**
   * Rolls on a loot table. The server picks the entry and writes it to the
   * table's target tab itself; `tabKey` is that tab, for `onRolled`. Resolves
   * true on success, so the caller knows whether to close its modal: a failed
   * roll keeps it open for a retry.
   */
  roll: (lootTableId: number, tabKey: string) => Promise<boolean>;
}

/**
 * Loot table rolls for a character's sheet tabs. Each table rolls into one
 * tab; the add form offers only the tables that target the tab it adds to.
 *
 * Tolerates rendering outside a GameProvider (the utility drawer's sheet has
 * none). Loot tables are game-scoped, so there the modes collapse to manual.
 *
 * `onRolled` receives the rolled entry and its tab once the server has written
 * it, so the caller can refetch or show it locally. It is never written back: the server
 * already has it.
 */
export function useLootRoll(
  characterId: number,
  onRolled: (entry: RawSheetEntry, tabKey: string) => void,
): LootRolling {
  const gameContext = useOptionalGameContext();
  const { showSuccess, showError } = useToast();

  const roll = async (lootTableId: number, tabKey: string): Promise<boolean> => {
    if (!gameContext) {
      // Defensive: the loot modes are hidden without a game context, so this
      // is unreachable through the UI.
      logger.error('Random loot roll attempted with no game context', { characterId });
      showError('Loot tables are unavailable here.');
      return false;
    }

    let content;
    try {
      ({ data: content } = await apiClient.games.giveRandomLootTableContent(gameContext.gameId, lootTableId, characterId));
    } catch (error: unknown) {
      // Without this a failed roll (e.g. the 400 for an empty table) left the
      // modal open with no feedback.
      const message = extractApiErrorMessage(error) || 'Failed to roll for a random item. Please try again.';
      logger.error('Random loot roll failed', { lootTableId, characterId, error });
      showError(message);
      return false;
    }

    // The payload is GM-authored JSON stored as free text, so it can be
    // malformed. Report that rather than throwing inside the success path.
    let rolled: unknown;
    try {
      rolled = JSON.parse(content.data);
    } catch {
      rolled = undefined;
    }
    if (typeof rolled !== 'object' || rolled === null || Array.isArray(rolled)) {
      logger.error('Loot item data is not a JSON object', { lootTableId, itemName: content.name });
      showError(`Rolled "${content.name}" but its item data is malformed. Check the loot table.`);
      return false;
    }

    onRolled(rolled as RawSheetEntry, tabKey);
    showSuccess(`Added ${content.name} to the character sheet`);
    return true;
  };

  return {
    modes: gameContext ? ['manual', 'loot_table', 'loot_table_random'] : ['manual'],
    roll,
  };
}
