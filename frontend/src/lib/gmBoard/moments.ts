/**
 * Perception: who reads each moment of a scene, and what they read.
 *
 * A moment has one shared text, a list of readers, and an optional own
 * version per reader. A moment with no readers is a private GM note. Who
 * *can* read (players, not NPCs nobody plays) is the caller's rule, passed in
 * as `canRead`.
 */

import { chunkIndex } from './states';
import { youify, type YouifyResult } from './youify';
import type { BoardDoc, Moment, Scene } from './types';

export type CanRead = (characterId: number) => boolean;

export const reads = (moment: Moment, characterId: number) => moment.readers.includes(characterId);

/** Nobody is ticked: only the GM sees it. */
export const isNote = (moment: Moment) => moment.readers.length === 0;

const hasOwnText = (moment: Moment, characterId: number) => !!moment.ownText[characterId]?.trim();

/** The words this reader gets: their own version if the GM wrote one, else the shared text. */
export const textFor = (moment: Moment, characterId: number) =>
  hasOwnText(moment, characterId) ? moment.ownText[characterId] : moment.text;

/**
 * The moment as this reader gets it. The shared text goes into second person
 * when `secondPerson` is on; an own version is never changed, since the GM
 * already wrote it for them.
 */
export function readerVersion(moment: Moment, characterId: number, names: string[], secondPerson: boolean): YouifyResult {
  const text = textFor(moment, characterId);
  if (hasOwnText(moment, characterId) || !secondPerson) return { text, marks: [], swapped: 0 };
  return youify(text, names);
}

export const readerText = (moment: Moment, characterId: number, names: string[], secondPerson: boolean) =>
  readerVersion(moment, characterId, names, secondPerson).text;

/** Everyone who reads the scene: the cast who can read, then anyone elsewhere ticked on a moment. */
export function sceneReaders(scene: Scene, canRead: CanRead): number[] {
  const ids = scene.participants.filter(canRead);
  for (const m of scene.moments) {
    for (const r of m.readers) if (canRead(r) && !ids.includes(r)) ids.push(r);
  }
  return ids;
}

/** A new moment, read by everyone in the scene who can read. */
export function newMoment(scene: Scene, canRead: CanRead, id: string, fields: Partial<Omit<Moment, 'id'>> = {}): Moment {
  return { id, text: '', readers: scene.participants.filter(canRead), ownText: {}, ...fields };
}

/** The scene with `moment` inserted at `at` (default: the end). */
export function insertMoment(scene: Scene, moment: Moment, at = scene.moments.length): Scene {
  const moments = [...scene.moments];
  moments.splice(Math.max(0, Math.min(at, moments.length)), 0, moment);
  return { ...scene, moments };
}

/**
 * Adds someone to the scene's cast. They're ticked on every moment all the
 * current readers in the cast already read, and on nothing private (a GM
 * note stays a note). Ticks they already had, as someone elsewhere, stay.
 */
export function joinScene(scene: Scene, characterId: number, canRead: CanRead): Scene {
  if (scene.participants.includes(characterId)) return scene;
  const cast = scene.participants.filter(canRead);
  const participants = [...scene.participants, characterId];
  if (!canRead(characterId)) return { ...scene, participants };
  const moments = scene.moments.map((m) =>
    reads(m, characterId) || isNote(m) || !cast.every((p) => reads(m, p)) ? m : { ...m, readers: [...m.readers, characterId] },
  );
  return { ...scene, participants, moments };
}

/** Takes someone out of the cast and off every moment. Their own versions stay, in case they come back. */
export function leaveScene(scene: Scene, characterId: number): Scene {
  if (!scene.participants.includes(characterId)) return scene;
  return {
    ...scene,
    participants: scene.participants.filter((p) => p !== characterId),
    moments: scene.moments.map((m) => (reads(m, characterId) ? { ...m, readers: m.readers.filter((r) => r !== characterId) } : m)),
  };
}

/** Scenes in time order (by slot; within a slot, the board's order). */
export function scenesInOrder(board: Pick<BoardDoc, 'chunks' | 'scenes'>): Scene[] {
  const index = chunkIndex(board);
  const at = (s: Scene) => index.get(s.chunkId) ?? Number.MAX_SAFE_INTEGER;
  return [...board.scenes].sort((a, b) => at(a) - at(b));
}

/** Every moment this character reads, with something written for them, grouped by scene in time order. */
export function perceivedMoments(board: Pick<BoardDoc, 'chunks' | 'scenes'>, characterId: number): { scene: Scene; moments: Moment[] }[] {
  const out: { scene: Scene; moments: Moment[] }[] = [];
  for (const scene of scenesInOrder(board)) {
    const moments = scene.moments.filter((m) => reads(m, characterId) && textFor(m, characterId).trim());
    if (moments.length) out.push({ scene, moments });
  }
  return out;
}

export type MissReason = 'no-text' | 'note' | 'not-ticked' | 'not-in-scene';

/** Why this character doesn't get this moment, or null if they do. */
export function missReason(moment: Moment, scene: Scene, characterId: number): MissReason | null {
  if (reads(moment, characterId)) return textFor(moment, characterId).trim() ? null : 'no-text';
  if (isNote(moment)) return 'note';
  return scene.participants.includes(characterId) ? 'not-ticked' : 'not-in-scene';
}
