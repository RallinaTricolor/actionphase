import { describe, it, expect } from 'vitest';
import { makeCard, makeScene } from '@/test-utils/factories';
import { NO_LOCATION } from '@/lib/gmBoard/map';
import { CAST, testModel } from './mapTestModel';
import { cellContents, characterGroups, flagSentence, groupName, isShown, presentIn } from './mapModel';

describe('buildMapModel', () => {
  it('marks cards played by someone out of play, unless that check was dismissed', () => {
    const board = {
      cards: [makeCard({ id: 'late', characterId: 1, locationId: 'mill', chunkId: 'k3', outcome: 'happened' as const })],
      scenes: [makeScene({ id: 's', locationId: 'dock', chunkId: 'k1', participants: [1], effects: [{ characterId: 1, state: 'captured' as const }] })],
    };
    expect(testModel(board).outCards).toEqual(new Set(['late']));
    expect(testModel({ ...board, dismissedFlags: { 'out:late': true } }).outCards).toEqual(new Set());
  });

  it('names characters with no record', () => {
    const model = testModel({ cards: [makeCard({ id: 'a', characterId: 44 })], scenes: [makeScene({ id: 's', participants: [45] })] });
    expect(model.names.get(44)).toBe('Character 44');
    expect(model.names.get(45)).toBe('Character 45');
    expect(model.names.get(1)).toBe('Harrison Vale');
  });

  it('stops resolving a slot that no longer exists', () => {
    expect(testModel({}, { resolving: 'k2' }).resolving).toBe('k2');
    expect(testModel({}, { resolving: 'gone' }).resolving).toBeNull();
  });

  it('shows NPCs whatever the cluster filter', () => {
    const model = testModel({}, { visible: [1] });
    expect(isShown(model, 1)).toBe(true);
    expect(isShown(model, 2)).toBe(false);
    expect(isShown(model, 9)).toBe(true);
  });
});

describe('cellContents and presentIn', () => {
  it('puts cards with a deleted location in the No location row, and leaves waiting cards out', () => {
    const model = testModel({
      cards: [
        makeCard({ id: 'a', characterId: 1, locationId: 'mill', chunkId: 'k2' }),
        makeCard({ id: 'b', characterId: 2, locationId: 'deleted', chunkId: 'k2' }),
        makeCard({ id: 'c', characterId: 3, locationId: 'mill', chunkId: null, isIF: true }),
      ],
    });
    const cells = cellContents(model);
    expect(cells.get('mill|k2')?.cards.map((c) => c.id)).toEqual(['a']);
    expect(cells.get(`${NO_LOCATION}|k2`)?.cards.map((c) => c.id)).toEqual(['b']);
    expect([...cells.keys()]).toHaveLength(2);
  });

  it('counts live cards and scene casts as present, not moot cards', () => {
    const cell = {
      cards: [makeCard({ id: 'a', characterId: 1 }), makeCard({ id: 'b', characterId: 2, outcome: 'moot' })],
      scenes: [makeScene({ id: 's', participants: [3, 1] })],
    };
    expect(presentIn(cell).sort()).toEqual([1, 3]);
    expect(presentIn(undefined)).toEqual([]);
  });
});

describe('characterGroups', () => {
  it('groups players by cluster, then the rest, then NPCs with cards; keeps leavers who have cards', () => {
    const model = testModel({
      clusters: [{ id: 'cl', name: 'Mill crew', characterIds: [2, 1] }],
      cards: [makeCard({ id: 'npc', characterId: 9 }), makeCard({ id: 'gone', characterId: 44 })],
    });
    expect(characterGroups(model)).toEqual([
      { id: 'cl', name: 'Mill crew', characterIds: [2, 1] },
      { id: '__rest', name: 'Not in a cluster', characterIds: [3, 44] },
      { id: '__npcs', name: 'NPCs', characterIds: [9] },
    ]);
  });

  it('keeps only the filtered cluster’s players', () => {
    const model = testModel({ clusters: [{ id: 'cl', name: 'Mill crew', characterIds: [2] }] }, { visible: [2] });
    expect(characterGroups(model).map((g) => g.characterIds)).toEqual([[2]]);
  });
});

describe('groupName', () => {
  it('names a group by first names', () => {
    expect(groupName([1, 2], CAST)).toBe('Harrison & Mara');
    expect(groupName([1, 2, 3], CAST)).toBe('Harrison, Mara & Ilse');
    expect(groupName([1, 2, 3, 9], CAST)).toBe('Harrison, Mara +2');
  });
});

describe('flagSentence', () => {
  const model = testModel({
    cards: [makeCard({ id: 'p', characterId: 2, locationId: 'mill', chunkId: 'k2', summary: 'Burns the ledger' })],
  });
  it('doesn’t double the full stop after a label that has one', () => {
    const withStop = testModel({ cards: [makeCard({ id: 'p', characterId: 2, chunkId: 'k2', quote: 'I burn the ledger. Then I run.' })] });
    expect(flagSentence({ kind: 'pending', key: 'p', characterId: 2, chunkId: 'k2', cardId: 'p' }, withStop)).toBe(
      'Mara Quill’s card in Slot 1 has no outcome: “I burn the ledger.”',
    );
  });

  it.each([
    [{ kind: 'out', key: 'o', characterId: 1, chunkId: 'k2', state: 'captured', cardId: 'p' }, 'Harrison Vale is captured but has a card in Slot 1: “Burns the ledger”.'],
    [{ kind: 'out', key: 'o', characterId: 1, chunkId: 'k2', state: 'dead', sceneId: 's' }, 'Harrison Vale is dead but is in a scene in Slot 1.'],
    [{ kind: 'two', key: 't', characterId: 3, chunkId: 'k3', locationIds: ['mill', 'dock'] }, 'Ilse is in 2 places in Slot 2: the Old Mill, dock.'],
    [{ kind: 'meeting', key: 'm', locationId: 'dock', chunkId: 'k1', characterIds: [1, 3] }, 'Harrison Vale, Ilse are at dock in Pre-Scenario, with no scene.'],
    [{ kind: 'pending', key: 'p', characterId: 2, chunkId: 'k2', cardId: 'p' }, 'Mara Quill’s card in Slot 1 has no outcome: “Burns the ledger”.'],
  ] as const)('%#', (flag, sentence) => {
    expect(flagSentence(flag as never, model)).toBe(sentence);
  });
});
