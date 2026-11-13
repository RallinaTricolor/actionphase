import { useOptionalGameContext } from '@/contexts/GameContext';
import { useToast } from '@/contexts/ToastContext';
import { apiClient } from '@/lib/api';
import { extractApiErrorMessage } from '@/lib/errors';
import { logger } from '@/services/LoggingService';
import type { RawSheetEntry } from '@/lib/sheetEntries';
import type { LootTableContent } from '@/types/games';

/**
 * How an entry can be added: typed in by hand, picked from a loot table, or
 * rolled at random on one.
 */
export type LootMode = 'manual' | 'loot_table' | 'loot_table_random';

export interface LootRolling {
  /** The add modes on offer. Only 'manual' outside a game. */
  modes: LootMode[];
  /**
   * Rolls on a loot table; `tabKey` is the table's target tab, for the
   * callback. Resolves true on success, so the caller knows whether to close
   * its modal: a failed roll keeps it open for a retry.
   */
  roll: (lootTableId: number, tabKey: string) => Promise<boolean>;
}

/** A rolled item: its name in the table, and its data with the entry's fresh id. */
export interface RolledItem {
  name: string;
  data: RawSheetEntry;
}

/**
 * The shared roll: asks the server, checks the item's data is an object, and
 * reports either way. `request` decides what the server does with the item.
 */
function useRoller(
  characterId: number,
  request: (gameId: number, lootTableId: number) => Promise<{ data: LootTableContent }>,
  onRolled: (item: RolledItem, tabKey: string) => void,
  doneMessage: (name: string) => string,
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
      ({ data: content } = await request(gameContext.gameId, lootTableId));
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

    onRolled({ name: content.name, data: rolled as RawSheetEntry }, tabKey);
    showSuccess(doneMessage(content.name));
    return true;
  };

  return {
    modes: gameContext ? ['manual', 'loot_table', 'loot_table_random'] : ['manual'],
    roll,
  };
}

/**
 * Loot table rolls for a character's live sheet. Each table rolls into one
 * tab; the add form offers only the tables that target the tab it adds to.
 *
 * Tolerates rendering outside a GameProvider (the utility drawer's sheet has
 * none). Loot tables are game-scoped, so there the modes collapse to manual.
 *
 * The server gives the item to the character and writes it to the sheet.
 * `onRolled` receives the entry as written, so the caller can refetch or show
 * it locally. It is never written back: the server already has it.
 *
 * Never use this while drafting a result's sheet updates: use useLootDraw.
 */
export function useLootRoll(characterId: number, onRolled: (entry: RawSheetEntry, tabKey: string) => void): LootRolling {
  return useRoller(
    characterId,
    (gameId, lootTableId) => apiClient.games.giveRandomLootTableContent(gameId, lootTableId, characterId),
    (item, tabKey) => onRolled(item.data, tabKey),
    (name) => `Added ${name} to the character sheet`,
  );
}

/**
 * Loot table rolls for a draft sheet update. The server only picks the item;
 * `onDrawn` adds it to the draft, which reaches the sheet when the result is
 * published. Nothing is written to the sheet or the game log.
 */
export function useLootDraw(characterId: number, onDrawn: (item: RolledItem, tabKey: string) => void): LootRolling {
  return useRoller(
    characterId,
    (gameId, lootTableId) => apiClient.games.drawLootTableContent(gameId, lootTableId),
    onDrawn,
    (name) => `Rolled ${name}: added to the staged updates`,
  );
}
