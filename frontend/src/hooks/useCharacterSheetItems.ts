import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { apiClient } from '../lib/api';
import { storageFieldName, type CharacterData, type SheetTab } from '../types/characters';
import { normalizeEntry, type RawSheetEntry, type SheetEntry } from '../lib/sheetEntries';
import { useOptionalGameContext } from '../contexts/GameContext';
import { useSheetLayout } from './useSheetLayout';

export interface SheetItem {
  id: string;
  name: string;
  /**
   * The kind written into a reference token, `[[Name|kind:id]]`. Stored in
   * posts, so it never changes: `skill` and `item` for the two tabs that were
   * mentionable first, the tab key for every other. See sheetRefKind.
   */
  refKind: string;
  /** The tab the entry lives on. */
  tabKey: string;
  /** The tab's name on this game's sheet, for badges and group headings. */
  tabLabel: string;
  description?: string;
  /** Human-readable metadata from the tab's choice and meta-line fields. */
  metadata?: string;
}

/**
 * The kind a reference token names an entry's tab by. Skills and Inventory
 * keep the `skill`/`item` their tokens have always carried, so existing posts
 * still resolve; any other tab uses its key, which never changes either.
 */
function sheetRefKind(tabKey: string): string {
  if (tabKey === 'skills') return 'skill';
  if (tabKey === 'inventory') return 'item';
  return tabKey;
}

/** A tab's badge colour: the two first-mentionable tabs keep theirs, every other tab shares one. */
export function sheetItemBadgeVariant(tabKey: string): 'success' | 'warning' | 'primary' {
  if (tabKey === 'skills') return 'success';
  if (tabKey === 'inventory') return 'warning';
  return 'primary';
}

function parseJsonField<T>(value: string | undefined): T[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

const text = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : undefined);

/**
 * A number field's value as text. Number(), not a typeof check: an entry
 * rolled from a CSV-imported loot table can hold "3".
 */
const numberText = (value: unknown) => {
  if (value === null || value === undefined || value === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed.toLocaleString() : undefined;
};

type IdentifiedEntry = RawSheetEntry & { id: string };

/** Rows a mention can key by. The name is checked after normalizeEntry. */
const hasId = (entry: RawSheetEntry): entry is IdentifiedEntry => typeof entry.id === 'string' && !!entry.id;

/**
 * The fields worth a glance in a tooltip, in schema order: a choice as its
 * value (it's a badge on the card), and a text or number field as
 * "Label: value", the way the card's meta line reads. Descriptions have their
 * own slot; tracks and checkboxes are left to the sheet.
 */
function metadataOf(tab: SheetTab, entry: SheetEntry): string | undefined {
  const parts = tab.fields.flatMap((field) => {
    const value = entry[field.key];
    if (field.type === 'select') return text(value) ?? [];
    const shown = field.type === 'number' ? numberText(value) : field.type === 'text' ? text(value) : undefined;
    return shown ? `${field.label}: ${shown}` : [];
  });
  return parts.length > 0 ? parts.join(' · ') : undefined;
}

/**
 * Turn one character's raw sheet rows into the flat item list the [[ref]]
 * tooltips resolve against: every entry on every tab of the game's layout.
 *
 * Rows the caller may not see are absent from the payload -- the backend has
 * already filtered them -- so anything reaching this function is showable.
 */
function toSheetItems(data: CharacterData[] | undefined, tabs: readonly SheetTab[]): SheetItem[] {
  if (!data) return [];

  return tabs.flatMap((tab) => {
    const row = data.find((d) => d.module_type === tab.key && d.field_name === storageFieldName(tab.key));
    return parseJsonField<RawSheetEntry>(row?.field_value)
      .filter(hasId)
      // Via normalizeEntry so the name and metadata read the same values the
      // card shows, including for rows still holding a legacy key (a Numbers
      // row named by `type`).
      .map((raw) => normalizeEntry(tab.key, raw))
      .filter((entry) => !!entry.name)
      .map((entry) => ({
        id: entry.id,
        name: entry.name,
        refKind: sheetRefKind(tab.key),
        tabKey: tab.key,
        tabLabel: tab.label,
        description: text(entry.description),
        metadata: metadataOf(tab, entry),
      }));
  });
}

/**
 * The game's sheet tabs, from GameContext. Outside a game (none of today's
 * callers) this is the default layout.
 */
function useLayoutTabs(): readonly SheetTab[] {
  return useSheetLayout(useOptionalGameContext()?.game).tabs;
}

export function useCharacterSheetItems(characterId: number | null): SheetItem[] {
  const { data } = useQuery({
    queryKey: ['characterData', characterId],
    queryFn: () =>
      apiClient.characters.getCharacterData(characterId!).then((r) => r.data),
    enabled: characterId !== null && characterId !== undefined,
    staleTime: 60_000,
  });

  const tabs = useLayoutTabs();
  return useMemo(() => toSheetItems(data, tabs), [data, tabs]);
}

/**
 * Sheet items for every character in a game, keyed by character id.
 *
 * One request for the whole cast, replacing a call to useCharacterSheetItems
 * per rendered character. A phase drill-down in History can show many
 * characters' action content at once, and the per-character hook meant that
 * opening a phase fired a burst of simultaneous requests.
 *
 * Visibility is entirely the backend's: each character's rows arrive already
 * reduced to what this caller may see (their own sheets in a live game; the
 * whole cast for a GM, an audience member, or a public archive). A character
 * with nothing visible simply yields an empty list, which renders as a plain
 * highlight with no tooltip.
 */
export function useGameCharacterSheetItems(gameId: number | null): Map<number, SheetItem[]> {
  const { data } = useQuery({
    queryKey: ['gameCharacterData', gameId],
    queryFn: () =>
      apiClient.characters.getGameCharacterData(gameId!).then((r) => r.data),
    enabled: gameId !== null && gameId !== undefined,
    staleTime: 60_000,
  });

  const tabs = useLayoutTabs();
  return useMemo(() => {
    const byCharacter = new Map<number, SheetItem[]>();
    if (!data) return byCharacter;

    for (const [characterId, rows] of Object.entries(data)) {
      const id = Number(characterId);
      if (Number.isNaN(id)) continue;
      byCharacter.set(id, toSheetItems(rows, tabs));
    }
    return byCharacter;
  }, [data, tabs]);
}
