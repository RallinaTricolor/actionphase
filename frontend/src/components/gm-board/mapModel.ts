import { cardLabel } from '@/lib/gmBoard/cards';
import type { CastMember } from '@/lib/gmBoard/cast';
import { computeFlags, openFlags, type BoardFlag } from '@/lib/gmBoard/flags';
import { boardRows, rowIdOf, sortedChunks } from '@/lib/gmBoard/map';
import { characterStates } from '@/lib/gmBoard/states';
import { shortName, truncate } from '@/lib/gmBoard/text';
import type { BoardDoc, Card, CharState, CodexEntry, Scene } from '@/lib/gmBoard/types';
import type { MapModel } from './mapTypes';

interface MapModelInput {
  board: BoardDoc;
  codex: CodexEntry[];
  phaseId: number;
  cast: CastMember[];
  names: Map<number, string>;
  nameLists: Map<number, string[]>;
  submitters: number[];
  visible: number[] | null;
  resolving: string | null;
}

/** Everything the Map views read, worked out once per board change. */
export function buildMapModel({ board, codex, phaseId, cast, names, nameLists, submitters, visible, resolving }: MapModelInput): MapModel {
  const flags = computeFlags(board);
  const open = openFlags(flags, board.dismissedFlags);
  return {
    board,
    slots: sortedChunks(board.chunks),
    rows: boardRows(codex, phaseId, board.cards),
    names: withFallbackNames(names, board),
    nameLists,
    cast: new Map(cast.map((c) => [c.id, c])),
    submitters: new Set(submitters),
    flags,
    open,
    outCards: new Set(open.flatMap((f) => (f.kind === 'out' && f.cardId ? [f.cardId] : []))),
    states: characterStates(board),
    visible: visible ? new Set(visible) : null,
    resolving: resolving && board.chunks.some((c) => c.id === resolving) ? resolving : null,
  };
}

/** Everyone on the board gets a name, so a character with no record (or a deleted one) reads "Character 12", not "?". */
function withFallbackNames(names: Map<number, string>, board: BoardDoc): Map<number, string> {
  const ids = [...board.cards.map((c) => c.characterId), ...board.scenes.flatMap((s) => s.participants)];
  if (ids.every((id) => names.has(id))) return names;
  const all = new Map(names);
  ids.forEach((id) => all.has(id) || all.set(id, `Character ${id}`));
  return all;
}

/** Whether the cluster filter shows a character's cards. NPCs always show: they belong to no cluster. */
export const isShown = (model: Pick<MapModel, 'visible' | 'cast'>, characterId: number) =>
  !model.visible || model.visible.has(characterId) || !!model.cast.get(characterId)?.npc;

export interface CellContents {
  cards: Card[];
  scenes: Scene[];
}

/** `${rowId}|${chunkId}` → the cards and scenes there. Waiting cards are left out (Contingencies). */
export function cellContents(model: Pick<MapModel, 'board' | 'rows'>): Map<string, CellContents> {
  const cells = new Map<string, CellContents>();
  const at = (rowId: string, chunkId: string) => {
    const key = `${rowId}|${chunkId}`;
    const cell = cells.get(key) ?? { cards: [], scenes: [] };
    cells.set(key, cell);
    return cell;
  };
  for (const c of model.board.cards) if (c.chunkId !== null) at(rowIdOf(c, model.rows), c.chunkId).cards.push(c);
  for (const s of model.board.scenes) at(rowIdOf(s, model.rows), s.chunkId).scenes.push(s);
  return cells;
}

/** Who is in a cell: owners of its live cards, and each scene's cast. */
export function presentIn(cell: CellContents | undefined): number[] {
  if (!cell) return [];
  const here = new Set<number>();
  cell.cards.forEach((c) => c.outcome !== 'moot' && here.add(c.characterId));
  cell.scenes.forEach((s) => s.participants.forEach((p) => here.add(p)));
  return [...here];
}

// ── Shared by the Map views ──

export const STATE_LABELS: Record<CharState, string> = {
  active: 'Active',
  injured: 'Injured',
  captured: 'Captured',
  incapacitated: 'Incapacitated',
  dead: 'Dead',
};

export const STATE_TONE: Record<CharState, 'neutral' | 'warning' | 'danger'> = {
  active: 'neutral',
  injured: 'warning',
  captured: 'danger',
  incapacitated: 'danger',
  dead: 'danger',
};

export interface CharacterGroup {
  id: string;
  name: string;
  characterIds: number[];
}

/**
 * The rows, grouped: each cluster in order, then players in no cluster, then
 * NPCs with a card here. The cluster filter keeps only its own players (and NPCs).
 */
export function characterGroups(model: Pick<MapModel, 'board' | 'cast' | 'visible'>): CharacterGroup[] {
  const players = [...model.cast.values()].filter((c) => !c.npc).map((c) => c.id);
  const shown = (id: number) => !model.visible || model.visible.has(id);
  const placed = new Set<number>();
  const groups: CharacterGroup[] = [];
  for (const cl of model.board.clusters) {
    const ids = cl.characterIds.filter((id) => players.includes(id) && !placed.has(id) && shown(id));
    ids.forEach((id) => placed.add(id));
    if (ids.length) groups.push({ id: cl.id, name: cl.name || 'Unnamed cluster', characterIds: ids });
  }
  const withCards = new Set(model.board.cards.map((c) => c.characterId));
  // A character who left the game keeps their cards, so they keep a row.
  const gone = [...withCards].filter((id) => !model.cast.has(id));
  const rest = [...players, ...gone].filter((id) => !placed.has(id) && shown(id));
  if (rest.length) groups.push({ id: '__rest', name: model.board.clusters.length ? 'Not in a cluster' : 'Players', characterIds: rest });
  const npcs = [...model.cast.values()].filter((c) => c.npc && withCards.has(c.id)).map((c) => c.id);
  if (npcs.length) groups.push({ id: '__npcs', name: 'NPCs', characterIds: npcs });
  return groups;
}

/** A name for a suggested group: "Mara, Ilse & Tov", or "Mara, Ilse +3". */
export function groupName(ids: number[], players: CastMember[]): string {
  const names = ids.map((id) => shortName(players.find((p) => p.id === id)?.name ?? '?'));
  if (names.length <= 3) return names.length > 1 ? `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}` : names[0];
  return `${names.slice(0, 2).join(', ')} +${names.length - 2}`;
}

/** One sentence per flag, for the checks list and Resolve mode. */
export function flagSentence(flag: BoardFlag, model: Pick<MapModel, 'board' | 'names' | 'rows'>): string {
  const name = (id: number) => model.names.get(id) ?? `Character ${id}`;
  const slot = model.board.chunks.find((c) => c.id === flag.chunkId)?.name ?? 'a time slot';
  const place = (id: string) => model.rows.find((r) => r.id === id)?.name ?? 'a deleted location';
  // A card's label, quoted; its own full stop (or ? or !) ends the sentence.
  const quoted = (cardId: string | undefined) => {
    const card = model.board.cards.find((c) => c.id === cardId);
    const label = card ? truncate(cardLabel(card), 60) : '';
    return `${label ? `: “${label}”` : ''}${/[.!?…]$/.test(label) ? '' : '.'}`;
  };
  switch (flag.kind) {
    case 'out':
      return flag.cardId
        ? `${name(flag.characterId)} is ${STATE_LABELS[flag.state].toLowerCase()} but has a card in ${slot}${quoted(flag.cardId)}`
        : `${name(flag.characterId)} is ${STATE_LABELS[flag.state].toLowerCase()} but is in a scene in ${slot}.`;
    case 'two':
      return `${name(flag.characterId)} is in ${flag.locationIds.length} places in ${slot}: ${flag.locationIds.map(place).join(', ')}.`;
    case 'meeting':
      return `${flag.characterIds.map(name).join(', ')} are at ${place(flag.locationId)} in ${slot}, with no scene.`;
    case 'pending':
      return `${name(flag.characterId)}’s card in ${slot} has no outcome${quoted(flag.cardId)}`;
  }
}

/** The card a flag is about, if it's about one card. */
export const flagCardId = (flag: BoardFlag) => (flag.kind === 'pending' || flag.kind === 'out' ? flag.cardId : undefined);

