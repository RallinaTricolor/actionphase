import { describe, it, expect } from 'vitest';
import { makeBoard, makeMoment, makeScene } from '@/test-utils/factories';
import {
  insertMoment,
  isNote,
  joinScene,
  leaveScene,
  missReason,
  newMoment,
  perceivedMoments,
  readerText,
  readerVersion,
  sceneReaders,
  scenesInOrder,
  textFor,
} from './moments';

// 1, 2, 3 are players; 90 is an NPC nobody plays.
const canRead = (id: number) => id !== 90;

describe('readers', () => {
  const scene = makeScene({ id: 's', participants: [1, 2, 90] });

  it('defaults a new moment’s readers to the players in the scene', () => {
    expect(newMoment(scene, canRead, 'm1').readers).toEqual([1, 2]);
  });

  it('makes a moment with nobody ticked a private GM note', () => {
    const m = newMoment(scene, canRead, 'm1', { text: 'The vault was empty all along.' });
    expect(isNote(m)).toBe(false);
    expect(isNote({ ...m, readers: [] })).toBe(true);
  });

  it('counts someone elsewhere ticked on a moment as a reader of the scene', () => {
    const s = { ...scene, moments: [makeMoment({ id: 'm', readers: [1, 3] })] };
    expect(sceneReaders(s, canRead)).toEqual([1, 2, 3]);
  });

  it('inserts a moment where asked, or at the end', () => {
    const s = { ...scene, moments: [makeMoment({ id: 'a' }), makeMoment({ id: 'b' })] };
    expect(insertMoment(s, makeMoment({ id: 'x' }), 1).moments.map((m) => m.id)).toEqual(['a', 'x', 'b']);
    expect(insertMoment(s, makeMoment({ id: 'y' })).moments.map((m) => m.id)).toEqual(['a', 'b', 'y']);
  });
});

describe('joinScene and leaveScene', () => {
  const scene = makeScene({
    id: 's',
    participants: [1, 2],
    moments: [
      makeMoment({ id: 'all', readers: [1, 2] }),
      makeMoment({ id: 'only1', readers: [1] }),
      makeMoment({ id: 'note', readers: [] }),
      makeMoment({ id: 'overheard', readers: [1, 2, 3] }),
    ],
  });

  it('ticks someone joining on the moments every current player reads, and nothing private', () => {
    const joined = joinScene(scene, 4, canRead);
    expect(joined.participants).toEqual([1, 2, 4]);
    expect(Object.fromEntries(joined.moments.map((m) => [m.id, m.readers]))).toEqual({
      all: [1, 2, 4],
      only1: [1],
      note: [],
      overheard: [1, 2, 3, 4],
    });
  });

  it('gives the first player into a scene of NPCs every moment but the GM notes', () => {
    const npcsOnly = makeScene({
      id: 'n',
      participants: [90],
      moments: [makeMoment({ id: 'note', readers: [] }), makeMoment({ id: 'overheard', readers: [3] })],
    });
    expect(joinScene(npcsOnly, 1, canRead).moments.map((m) => m.readers)).toEqual([[], [3, 1]]);
  });

  it('keeps the ticks of someone elsewhere who joins', () => {
    const joined = joinScene(scene, 3, canRead);
    expect(joined.moments.find((m) => m.id === 'overheard')?.readers).toEqual([1, 2, 3]);
    expect(joined.moments.find((m) => m.id === 'only1')?.readers).toEqual([1]);
  });

  it('adds an NPC to the cast without ticking them on anything', () => {
    const joined = joinScene(scene, 90, canRead);
    expect(joined.participants).toEqual([1, 2, 90]);
    expect(joined.moments).toBe(scene.moments);
  });

  it('changes nothing for someone already in the scene', () => {
    expect(joinScene(scene, 1, canRead)).toBe(scene);
  });

  it('takes someone leaving off every moment, keeping their own versions', () => {
    const withOwn = { ...scene, moments: [makeMoment({ id: 'm', readers: [1, 2], ownText: { 2: 'You hide.' } })] };
    const left = leaveScene(withOwn, 2);
    expect(left.participants).toEqual([1]);
    expect(left.moments[0]).toMatchObject({ readers: [1], ownText: { 2: 'You hide.' } });
  });
});

describe('reader text', () => {
  const m = makeMoment({
    id: 'm',
    text: 'Harrison opens the door and Mara draws her knife.',
    readers: [1, 2],
    ownText: { 2: 'You hear the door open behind Harrison.' },
  });

  it('replaces the shared text with an own version for that reader only', () => {
    expect(textFor(m, 2)).toBe('You hear the door open behind Harrison.');
    expect(textFor(m, 1)).toBe('Harrison opens the door and Mara draws her knife.');
  });

  it('puts the shared text in second person, but never an own version', () => {
    expect(readerText(m, 1, ['Harrison'], true)).toBe('You open the door and Mara draws her knife.');
    expect(readerText(m, 2, ['Mara'], true)).toBe('You hear the door open behind Harrison.');
    expect(readerVersion(m, 2, ['Harrison'], true).swapped).toBe(0);
  });

  it('leaves the shared text alone when second person is off', () => {
    expect(readerText(m, 1, ['Harrison'], false)).toBe(m.text);
  });

  it('ignores a blank own version', () => {
    expect(textFor({ ...m, ownText: { 1: '  ' } }, 1)).toBe(m.text);
  });
});

describe('perceivedMoments', () => {
  const board = makeBoard({
    scenes: [
      makeScene({ id: 'late', chunkId: 'k3', moments: [makeMoment({ id: 'm3', text: 'Late.', readers: [1] })] }),
      makeScene({
        id: 'early',
        chunkId: 'k1',
        moments: [
          makeMoment({ id: 'm1', text: 'Early.', readers: [1] }),
          makeMoment({ id: 'blank', text: ' ', readers: [1] }),
          makeMoment({ id: 'theirs', text: 'Not yours.', readers: [2] }),
        ],
      }),
      makeScene({ id: 'none', chunkId: 'k2', moments: [makeMoment({ id: 'm2', text: 'Unseen.', readers: [] })] }),
    ],
  });

  it('lists what the reader gets, with text, by scene in time order', () => {
    expect(perceivedMoments(board, 1).map((g) => [g.scene.id, g.moments.map((m) => m.id)])).toEqual([
      ['early', ['m1']],
      ['late', ['m3']],
    ]);
  });

  it('orders scenes by time slot, keeping the board’s order within a slot', () => {
    const b = makeBoard({
      scenes: [
        makeScene({ id: 'b', chunkId: 'k2' }),
        makeScene({ id: 'c', chunkId: 'k1' }),
        makeScene({ id: 'a', chunkId: 'k2' }),
      ],
    });
    expect(scenesInOrder(b).map((s) => s.id)).toEqual(['c', 'b', 'a']);
  });

  it('says why someone misses a moment', () => {
    const scene = makeScene({ id: 's', participants: [1, 2] });
    expect(missReason(makeMoment({ id: 'a', text: 'x', readers: [1] }), scene, 1)).toBeNull();
    expect(missReason(makeMoment({ id: 'a', text: '', readers: [1] }), scene, 1)).toBe('no-text');
    expect(missReason(makeMoment({ id: 'a', text: 'x', readers: [] }), scene, 1)).toBe('note');
    expect(missReason(makeMoment({ id: 'a', text: 'x', readers: [1] }), scene, 2)).toBe('not-ticked');
    expect(missReason(makeMoment({ id: 'a', text: 'x', readers: [1] }), scene, 3)).toBe('not-in-scene');
  });
});
