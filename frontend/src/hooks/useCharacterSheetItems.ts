import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { apiClient } from '../lib/api';
import type { CharacterData } from '../types/characters';
import { normalizeEntry, type RawSheetEntry } from '../lib/sheetEntries';

export interface SheetItem {
  id: string;
  name: string;
  type: 'skill' | 'item';
  description?: string;
  /** Human-readable metadata: skill rank/category, item category/quantity */
  metadata?: string;
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

const text = (value: unknown) => (typeof value === 'string' && value ? value : undefined);

type IdentifiedEntry = RawSheetEntry & { id: string };

/** Rows a mention can point at: an id to key by and a name to match. */
const isMentionable = (entry: RawSheetEntry): entry is IdentifiedEntry =>
  typeof entry.id === 'string' && !!entry.id && typeof entry.name === 'string' && !!entry.name;

function skillToSheetItem(raw: IdentifiedEntry): SheetItem {
  // Via normalizeEntry so mention metadata reads the same value the card shows,
  // including for rows still holding the pre-rename `level` key.
  const s = normalizeEntry('skills', raw);
  const rank = text(s.rank);
  const meta = [text(s.category), rank ? `Rank ${rank}` : undefined]
    .filter(Boolean)
    .join(' · ');
  return {
    id: s.id,
    name: s.name,
    type: 'skill',
    description: text(s.description),
    metadata: meta || undefined,
  };
}

function itemToSheetItem(raw: IdentifiedEntry): SheetItem {
  const i = normalizeEntry('inventory', raw);
  // Number(), not a typeof check: an entry rolled from a CSV-imported loot
  // table is written verbatim by the server, so its quantity can be "3".
  const quantity = Number(i.quantity);
  const meta = [text(i.category), quantity > 1 ? `×${quantity}` : undefined]
    .filter(Boolean)
    .join(' · ');
  return {
    id: i.id,
    name: i.name,
    type: 'item',
    description: text(i.description),
    metadata: meta || undefined,
  };
}

/**
 * Turn one character's raw sheet rows into the flat item list the [[ref]]
 * tooltips resolve against.
 *
 * Rows the caller may not see are absent from the payload -- the backend has
 * already filtered them -- so anything reaching this function is showable.
 */
function toSheetItems(data: CharacterData[] | undefined): SheetItem[] {
  if (!data) return [];

  const getField = (moduleType: string, fieldName: string): string | undefined =>
    data.find((d) => d.module_type === moduleType && d.field_name === fieldName)?.field_value;

  const skills = parseJsonField<RawSheetEntry>(getField('skills', 'skills'));
  const items = parseJsonField<RawSheetEntry>(getField('inventory', 'items'));

  return [
    ...skills.filter(isMentionable).map(skillToSheetItem),
    ...items.filter(isMentionable).map(itemToSheetItem),
  ];
}

export function useCharacterSheetItems(characterId: number | null): SheetItem[] {
  const { data } = useQuery({
    queryKey: ['characterData', characterId],
    queryFn: () =>
      apiClient.characters.getCharacterData(characterId!).then((r) => r.data),
    enabled: characterId !== null && characterId !== undefined,
    staleTime: 60_000,
  });

  return useMemo(() => toSheetItems(data), [data]);
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

  return useMemo(() => {
    const byCharacter = new Map<number, SheetItem[]>();
    if (!data) return byCharacter;

    for (const [characterId, rows] of Object.entries(data)) {
      const id = Number(characterId);
      if (Number.isNaN(id)) continue;
      byCharacter.set(id, toSheetItems(rows));
    }
    return byCharacter;
  }, [data]);
}
