/**
 * Scenes: making one from a busy Map cell, its title, the order the Scenes
 * step walks them in, and the edits made to its moments and effects. Pure:
 * the Scenes step turns the results into item edits. Who reads what is in
 * `moments.ts`.
 */

import { isWaiting } from './cards';
import { isNote, newMoment, reads, sceneReaders, scenesInOrder, type CanRead } from './moments';
import { chunkIndex } from './states';
import { shortName } from './text';
import type { BoardDoc, Card, CharState, Chunk, Moment, Scene } from './types';

type StateEffect = Scene['effects'][number];

/**
 * A scene for a cell: everyone with a live card there is in it, and it starts
 * with one empty moment for them all.
 */
export function newScene(
  board: Pick<BoardDoc, 'cards'>,
  cell: { locationId: string; chunkId: string },
  ids: { scene: string; moment: string },
  canRead: CanRead,
): Scene {
  const participants = [
    ...new Set(
      board.cards
        .filter((c) => c.locationId === cell.locationId && c.chunkId === cell.chunkId && c.outcome !== 'moot')
        .map((c) => c.characterId),
    ),
  ];
  const scene: Scene = { id: ids.scene, title: '', ...cell, conflict: false, participants, moments: [], effects: [] };
  return { ...scene, moments: [newMoment(scene, canRead, ids.moment)] };
}

/** The stored doc: the scene without its id. */
export function sceneDoc(scene: Scene): Omit<Scene, 'id'> {
  const { id: _id, ...doc } = scene;
  return doc;
}

/** "Harrison, Mara +2": the cast by short name, at most `max` of them. */
export function castNames(ids: number[], names: Map<number, string>, max = 3): string {
  const all = ids.map((id) => shortName(names.get(id) ?? `Character ${id}`));
  if (!all.length) return 'nobody yet';
  return all.length > max ? `${all.slice(0, max).join(', ')} +${all.length - max}` : all.join(', ');
}

/** A scene's name: the GM's title, or its cast when it has none. */
export const sceneName = (scene: Scene, names: Map<number, string>) => scene.title.trim() || castNames(scene.participants, names);

/** The scenes grouped by time slot, in time order, for the scene picker. Scenes in a deleted slot come last. */
export function sceneGroups(board: Pick<BoardDoc, 'chunks' | 'scenes'>): { chunk: Chunk | null; scenes: Scene[] }[] {
  const groups: { chunk: Chunk | null; scenes: Scene[] }[] = [];
  for (const scene of scenesInOrder(board)) {
    const chunk = board.chunks.find((c) => c.id === scene.chunkId) ?? null;
    const last = groups[groups.length - 1];
    if (last && (last.chunk?.id ?? null) === (chunk?.id ?? null)) last.scenes.push(scene);
    else groups.push({ chunk, scenes: [scene] });
  }
  return groups;
}

/** The scenes before and after this one in time order. */
export function sceneNeighbours(board: Pick<BoardDoc, 'chunks' | 'scenes'>, sceneId: string) {
  const list = scenesInOrder(board);
  const i = list.findIndex((s) => s.id === sceneId);
  return { prev: i > 0 ? list[i - 1] : null, next: i >= 0 && i < list.length - 1 ? list[i + 1] : null, index: i, total: list.length };
}

/** Deleting a scene: the cards that cite it as a cause, with the citation removed. */
export function cardsCitingScene(cards: Card[], sceneId: string): Card[] {
  return cards.filter((c) => c.causedBy.includes(sceneId)).map((c) => ({ ...c, causedBy: c.causedBy.filter((id) => id !== sceneId) }));
}

/** People in the scene's cell (a live card there) who aren't in its cast. */
export function nearby(board: Pick<BoardDoc, 'cards'>, scene: Scene): number[] {
  const ids = board.cards
    .filter((c) => c.locationId === scene.locationId && c.chunkId === scene.chunkId && c.outcome !== 'moot')
    .map((c) => c.characterId);
  return [...new Set(ids)].filter((id) => !scene.participants.includes(id));
}

/** A character's cards, as the Plans tab shows them for a scene: this time slot, waiting IF cards, then other times in order. */
export function plansFor(board: Pick<BoardDoc, 'cards' | 'chunks'>, scene: Scene, characterId: number) {
  const index = chunkIndex(board);
  const mine = board.cards.filter((c) => c.characterId === characterId);
  return {
    here: mine.filter((c) => c.chunkId === scene.chunkId),
    waiting: mine.filter(isWaiting),
    other: mine
      .filter((c) => c.chunkId !== null && c.chunkId !== scene.chunkId)
      .sort((a, b) => (index.get(a.chunkId as string) ?? 0) - (index.get(b.chunkId as string) ?? 0)),
  };
}

// ── Moments ──

/** The scene with one moment changed. */
export const updateMoment = (scene: Scene, momentId: string, fn: (m: Moment) => Moment): Scene => ({
  ...scene,
  moments: scene.moments.map((m) => (m.id === momentId ? fn(m) : m)),
});

export const removeMoment = (scene: Scene, momentId: string): Scene => ({ ...scene, moments: scene.moments.filter((m) => m.id !== momentId) });

/** Moves a moment up (-1) or down (+1). Past either end, nothing changes. */
export function moveMoment(scene: Scene, momentId: string, by: -1 | 1): Scene {
  const i = scene.moments.findIndex((m) => m.id === momentId);
  const j = i + by;
  if (i < 0 || j < 0 || j >= scene.moments.length) return scene;
  const moments = [...scene.moments];
  [moments[i], moments[j]] = [moments[j], moments[i]];
  return { ...scene, moments };
}

/** Ticks or unticks a reader. Their own version stays, in case they're ticked again. */
export function setReader(moment: Moment, characterId: number, on: boolean): Moment {
  if (on === reads(moment, characterId)) return moment;
  return { ...moment, readers: on ? [...moment.readers, characterId] : moment.readers.filter((r) => r !== characterId) };
}

/** Sets a reader's own version. An empty one is kept until dropped, so the box stays open while the GM clears it to retype. */
export const setOwnText = (moment: Moment, characterId: number, text: string): Moment => ({
  ...moment,
  ownText: { ...moment.ownText, [characterId]: text },
});

/** Back to the shared text for this reader. */
export function dropOwnText(moment: Moment, characterId: number): Moment {
  const { [characterId]: _gone, ...rest } = moment.ownText;
  return { ...moment, ownText: rest };
}

/** Readers who have an own version open (even an empty one), in the order they read. */
export const ownTextReaders = (moment: Moment) => moment.readers.filter((r) => typeof moment.ownText[r] === 'string');

/**
 * The line under a moment about who reads it, or '' when everyone in the
 * scene does and nothing needs saying.
 */
export function readersNote(moment: Moment, scene: Scene, canRead: CanRead, names: Map<number, string>): string {
  const all = sceneReaders(scene, canRead);
  if (!all.length) return 'Nobody here reads results yet. Add a player to the cast.';
  if (isNote(moment)) return '';
  const on = all.filter((id) => reads(moment, id));
  const shared = on.filter((id) => typeof moment.ownText[id] !== 'string' || !moment.ownText[id].trim());
  if (on.length && !shared.length) {
    return 'Everyone ticked has their own version, so nobody reads the shared text.';
  }
  if (on.length < all.length) return `Only ${castNames(on, names, 6)} ${on.length === 1 ? 'reads' : 'read'} this.`;
  return '';
}

// ── Effects ──

export const addEffect = (scene: Scene, characterId: number, state: CharState = 'injured'): Scene => ({
  ...scene,
  effects: [...scene.effects, { characterId, state }],
});

export function updateEffect(scene: Scene, index: number, fields: Partial<StateEffect>): Scene {
  const effects = scene.effects.map((e, i) => {
    if (i !== index) return e;
    const next = { ...e, ...fields };
    if (!next.untilChunkId) delete next.untilChunkId;
    return next;
  });
  return { ...scene, effects };
}

export const removeEffect = (scene: Scene, index: number): Scene => ({ ...scene, effects: scene.effects.filter((_, i) => i !== index) });

/** The time slots an effect can end before: every one after the scene's. */
export function laterSlots(board: Pick<BoardDoc, 'chunks'>, scene: Scene): Chunk[] {
  const sorted = [...board.chunks].sort((a, b) => a.position - b.position);
  const i = sorted.findIndex((c) => c.id === scene.chunkId);
  return i < 0 ? [] : sorted.slice(i + 1);
}

// ── Text ──

/**
 * `text` inserted into `value` between `start` and `end`, with a space either
 * side where it would otherwise run into a word. Returns the new value and
 * where the cursor goes (just after the insert).
 */
export function insertAt(value: string, start: number, end: number, text: string): { value: string; cursor: number } {
  const a = Math.max(0, Math.min(start, value.length));
  const b = Math.max(a, Math.min(end, value.length));
  const before = value.slice(0, a);
  const after = value.slice(b);
  const lead = before && !/\s$/.test(before) ? ' ' : '';
  const trail = after && !/^[\s.,;:!?)]/.test(after) ? ' ' : '';
  return { value: before + lead + text + trail + after, cursor: a + lead.length + text.length };
}

/** A rough word count, for the Reads as pane. */
export const wordCount = (text: string) => (text.trim() ? text.trim().split(/\s+/).length : 0);
