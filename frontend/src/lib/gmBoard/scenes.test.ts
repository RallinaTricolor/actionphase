import { describe, it, expect } from 'vitest';
import { makeBoard, makeCard, makeMoment, makeScene } from '@/test-utils/factories';
import {
  addEffect,
  cardsCitingScene,
  castNames,
  dropOwnText,
  insertAt,
  laterSlots,
  moveMoment,
  nearby,
  newScene,
  ownTextReaders,
  plansFor,
  readersNote,
  removeEffect,
  sceneDoc,
  sceneGroups,
  sceneName,
  sceneNeighbours,
  setOwnText,
  setReader,
  updateEffect,
  wordCount,
} from './scenes';

// Hand-written test data. 1–3 are players; 9 is an NPC nobody plays.
const canRead = (id: number) => id !== 9;
const names = new Map([
  [1, 'Harrison Vale'],
  [2, 'Mara Quill'],
  [3, 'Ilse'],
  [9, 'Bo Hale'],
]);

describe('newScene', () => {
  it('casts everyone with a live card in the cell, with one moment read by the players', () => {
    const board = makeBoard({
      cards: [
        makeCard({ id: 'a', characterId: 1, locationId: 'mill', chunkId: 'k2' }),
        makeCard({ id: 'b', characterId: 9, locationId: 'mill', chunkId: 'k2' }),
        makeCard({ id: 'c', characterId: 1, locationId: 'mill', chunkId: 'k2' }),
        makeCard({ id: 'd', characterId: 2, locationId: 'mill', chunkId: 'k2', outcome: 'moot' }),
        makeCard({ id: 'e', characterId: 3, locationId: 'dock', chunkId: 'k2' }),
      ],
    });
    const scene = newScene(board, { locationId: 'mill', chunkId: 'k2' }, { scene: 's1', moment: 'm1' }, canRead);
    expect(scene).toEqual({
      id: 's1',
      title: '',
      locationId: 'mill',
      chunkId: 'k2',
      conflict: false,
      participants: [1, 9],
      moments: [{ id: 'm1', text: '', readers: [1], ownText: {} }],
      effects: [],
    });
    expect(sceneDoc(scene)).not.toHaveProperty('id');
  });
});

describe('names', () => {
  it('names a scene by its title, else its cast', () => {
    expect(sceneName(makeScene({ id: 's', title: ' The ambush ', participants: [1] }), names)).toBe('The ambush');
    expect(sceneName(makeScene({ id: 's', participants: [1, 2, 3, 9] }), names)).toBe('Harrison, Mara, Ilse +1');
    expect(castNames([], names)).toBe('nobody yet');
    expect(castNames([44], names)).toBe('Character 44');
  });
});

describe('order', () => {
  const board = makeBoard({
    scenes: [
      makeScene({ id: 'a', chunkId: 'k3' }),
      makeScene({ id: 'b', chunkId: 'k1' }),
      makeScene({ id: 'c', chunkId: 'gone' }),
      makeScene({ id: 'd', chunkId: 'k3' }),
    ],
  });

  it('groups scenes by time slot in time order, a deleted slot last', () => {
    expect(sceneGroups(board).map((g) => [g.chunk?.name ?? null, g.scenes.map((s) => s.id)])).toEqual([
      ['Pre-Scenario', ['b']],
      ['Slot 2', ['a', 'd']],
      [null, ['c']],
    ]);
  });

  it('walks previous and next in that order', () => {
    expect(sceneNeighbours(board, 'b')).toMatchObject({ prev: null, next: { id: 'a' }, index: 0, total: 4 });
    expect(sceneNeighbours(board, 'd')).toMatchObject({ prev: { id: 'a' }, next: { id: 'c' }, index: 2 });
    expect(sceneNeighbours(board, 'c').next).toBeNull();
  });
});

describe('cells', () => {
  const scene = makeScene({ id: 's', locationId: 'mill', chunkId: 'k2', participants: [1] });
  const board = makeBoard({
    cards: [
      makeCard({ id: 'here', characterId: 2, locationId: 'mill', chunkId: 'k2', causedBy: ['s', 'x'] }),
      makeCard({ id: 'moot', characterId: 3, locationId: 'mill', chunkId: 'k2', outcome: 'moot' }),
      makeCard({ id: 'mine', characterId: 1, locationId: 'mill', chunkId: 'k2' }),
      makeCard({ id: 'later', characterId: 1, locationId: 'dock', chunkId: 'k3' }),
      makeCard({ id: 'early', characterId: 1, locationId: 'dock', chunkId: 'k1' }),
      makeCard({ id: 'if', characterId: 1, chunkId: null, isIF: true, cond: 'the bell rings' }),
    ],
  });

  it('finds who else is in the cell, leaving out moot cards and the cast', () => {
    expect(nearby(board, scene)).toEqual([2]);
  });

  it('takes a deleted scene out of the causes that cite it', () => {
    expect(cardsCitingScene(board.cards, 's')).toEqual([expect.objectContaining({ id: 'here', causedBy: ['x'] })]);
  });

  it('splits a character’s plans into this slot, waiting, and other times in order', () => {
    const plans = plansFor(board, scene, 1);
    expect(plans.here.map((c) => c.id)).toEqual(['mine']);
    expect(plans.waiting.map((c) => c.id)).toEqual(['if']);
    expect(plans.other.map((c) => c.id)).toEqual(['early', 'later']);
  });
});

describe('moments', () => {
  const m = makeMoment({ id: 'm', text: 'Harrison draws.', readers: [1, 2] });

  it('moves a moment, and stops at either end', () => {
    const scene = makeScene({ id: 's', moments: [makeMoment({ id: 'a' }), makeMoment({ id: 'b' })] });
    expect(moveMoment(scene, 'b', -1).moments.map((x) => x.id)).toEqual(['b', 'a']);
    expect(moveMoment(scene, 'a', -1)).toBe(scene);
    expect(moveMoment(scene, 'b', 1)).toBe(scene);
  });

  it('ticks and unticks readers, keeping an own version for later', () => {
    const own = setOwnText(m, 2, 'You see a flash.');
    const off = setReader(own, 2, false);
    expect(off.readers).toEqual([1]);
    expect(off.ownText[2]).toBe('You see a flash.');
    expect(setReader(off, 2, true).readers).toEqual([1, 2]);
    expect(setReader(m, 1, true)).toBe(m);
  });

  it('opens, lists and drops own versions', () => {
    const open = setOwnText(m, 2, '');
    expect(ownTextReaders(open)).toEqual([2]);
    expect(dropOwnText(open, 2).ownText).toEqual({});
  });

  it('says who reads a moment when not everyone does', () => {
    const scene = makeScene({ id: 's', participants: [1, 2, 9], moments: [m] });
    expect(readersNote(m, scene, canRead, names)).toBe('');
    expect(readersNote(setReader(m, 2, false), scene, canRead, names)).toBe('Only Harrison reads this.');
    expect(readersNote({ ...m, readers: [] }, scene, canRead, names)).toBe('');
    const both = setOwnText(setOwnText(m, 1, 'You draw.'), 2, 'He draws.');
    expect(readersNote(both, scene, canRead, names)).toBe('Everyone ticked has their own version, so nobody reads the shared text.');
    const noPlayers = makeScene({ id: 's', participants: [9] });
    expect(readersNote(makeMoment({ id: 'x' }), noPlayers, canRead, names)).toBe('Nobody here reads results yet. Add a player to the cast.');
  });
});

describe('effects', () => {
  const board = makeBoard();
  const scene = makeScene({ id: 's', chunkId: 'k2' });

  it('adds, changes and removes effects; an empty "until" means the end of the phase', () => {
    const one = addEffect(scene, 1);
    expect(one.effects).toEqual([{ characterId: 1, state: 'injured' }]);
    const until = updateEffect(one, 0, { state: 'captured', untilChunkId: 'k3' });
    expect(until.effects).toEqual([{ characterId: 1, state: 'captured', untilChunkId: 'k3' }]);
    expect(updateEffect(until, 0, { untilChunkId: '' }).effects).toEqual([{ characterId: 1, state: 'captured' }]);
    expect(removeEffect(until, 0).effects).toEqual([]);
  });

  it('offers only later slots to end an effect before', () => {
    expect(laterSlots(board, scene).map((c) => c.id)).toEqual(['k3']);
    expect(laterSlots(board, makeScene({ id: 's', chunkId: 'gone' }))).toEqual([]);
  });
});

describe('insertAt', () => {
  it('puts spaces around an insert only where it would run into a word', () => {
    expect(insertAt('Mara lifts the', 14, 14, '**Lantern**')).toEqual({ value: 'Mara lifts the **Lantern**', cursor: 26 });
    expect(insertAt('lifts.', 0, 0, 'Mara')).toEqual({ value: 'Mara lifts.', cursor: 4 });
    expect(insertAt('the x.', 4, 5, 'mill')).toEqual({ value: 'the mill.', cursor: 8 });
    expect(insertAt('', 3, 3, 'Ilse')).toEqual({ value: 'Ilse', cursor: 4 });
  });

  it('counts words', () => {
    expect(wordCount('  You enter the mill. ')).toBe(4);
    expect(wordCount('')).toBe(0);
  });
});
