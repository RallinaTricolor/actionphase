import { describe, it, expect } from 'vitest';
import { makeGmItem } from '@/test-utils/factories';
import {
  applyConflicts,
  assembleBoard,
  assembleSettings,
  editItem,
  getDoc,
  hasPendingChanges,
  itemId,
  liveItems,
  loadState,
  markSaved,
  mergeServerItems,
  newItemKey,
  reapplyLost,
  removeItem,
  toChangeRequests,
  type StoreState,
} from './store';

const card = (key: string, summary: string, seq = 1, version = 1) =>
  makeGmItem({ kind: 'card', key, seq, version, doc: { summary, characterId: 3 } });

const dirtyList = (s: StoreState) => Object.values(s.dirty);

describe('assembleBoard', () => {
  const items = [
    card('c2', 'launch', 3),
    makeGmItem({ kind: 'chunk', key: 'k2', seq: 2, doc: { name: 'Beat 1', position: 2 } }),
    makeGmItem({ kind: 'chunk', key: 'k1', seq: 4, doc: { name: 'Pre-Scenario', position: 1 } }),
    card('c1', 'plant the sword', 5),
    makeGmItem({ kind: 'stance', key: '3|4', seq: 6, doc: { value: 'wary', note: 'owes money' } }),
    makeGmItem({ kind: 'progress', key: '3', seq: 7, doc: { readDone: true, covered: { m1: false } } }),
    makeGmItem({ kind: 'progress', key: '4', seq: 8, doc: { ready: true } }),
    makeGmItem({ kind: 'flag', key: 'two:3:k1', seq: 9 }),
    makeGmItem({ kind: 'notes', key: 'notes', seq: 10, doc: { text: 'check the vault' } }),
  ];

  it('builds the same board from items in any order', () => {
    const forward = assembleBoard(liveItems(loadState(items, 10)));
    const backward = assembleBoard(liveItems(loadState([...items].reverse(), 10)));
    expect(backward).toEqual(forward);

    expect(forward.chunks.map((c) => c.name)).toEqual(['Pre-Scenario', 'Beat 1']);
    expect(forward.cards.map((c) => c.id)).toEqual(['c1', 'c2']);
    expect(forward.cards[0]).toMatchObject({ id: 'c1', summary: 'plant the sword', characterId: 3 });
    expect(forward.stances['3|4']).toEqual({ value: 'wary', note: 'owes money' });
    expect(forward.readDone).toEqual({ 3: true });
    expect(forward.ready).toEqual({ 4: true });
    expect(forward.covered).toEqual({ 3: { m1: false } });
    expect(forward.dismissedFlags).toEqual({ 'two:3:k1': true });
    expect(forward.notes).toBe('check the vault');
  });

  it('leaves out tombstones', () => {
    const state = loadState([card('c1', 'x'), makeGmItem({ kind: 'card', key: 'c2', deleted: true, doc: undefined, version: 3 })], 2);
    expect(assembleBoard(liveItems(state)).cards.map((c) => c.id)).toEqual(['c1']);
  });

  it('defaults a scene’s missing lists, so a partial item still opens', () => {
    const board = assembleBoard([{ kind: 'scene', key: 's1', doc: { title: 'Ambush', moments: [{ id: 'm1', text: 'x' }] } }]);
    expect(board.scenes[0]).toMatchObject({ id: 's1', title: 'Ambush', participants: [], effects: [], conflict: false });
    expect(board.scenes[0].moments).toEqual([{ id: 'm1', text: 'x', readers: [], ownText: {} }]);
  });

  it('starts empty', () => {
    const board = assembleBoard([]);
    expect(board.notes).toBe('');
    expect(board.cards).toEqual([]);
    expect(board.rewardItems).toEqual([]);
    expect(board.rewards).toEqual({});
  });

  it('reads this phase’s reward list in position order, and each character’s rewards with defaults', () => {
    const board = assembleBoard([
      { kind: 'reward', key: 'r2', doc: { name: 'Glutton', group: 'bonus', text: 'Ate it', ops: [], position: 2 } },
      { kind: 'reward', key: 'r1', doc: { name: 'Survivor', group: 'bonus', position: 1, choose: 1 } },
      { kind: 'rewards', key: '3', doc: { lines: [{ id: 'l1', group: 'bonus' }], carrierHeadId: 40 } },
    ]);
    expect(board.rewardItems.map((i) => i.id)).toEqual(['r1', 'r2']);
    expect(board.rewardItems[0]).toEqual({ id: 'r1', scope: 'phase', name: 'Survivor', group: 'bonus', text: '', ops: [], choose: true, position: 1 });
    expect(board.rewards[3]).toEqual({ lines: [{ id: 'l1', group: 'bonus', text: '', ops: [], choose: false }], texts: {}, carrierHeadId: 40 });
  });
});

describe('assembleSettings', () => {
  it('defaults second person to on, and reads each kind', () => {
    expect(assembleSettings([]).secondPerson).toBe(true);
    const settings = assembleSettings([
      { kind: 'codex', key: 'loc1', doc: { type: 'Location', name: 'Hangar', aliases: [], notes: '', secret: false, phases: [] } },
      { kind: 'names', key: '3', doc: { names: ['Harrison Vale', 'Harrison'] } },
      { kind: 'template', key: 'template', doc: { text: '{{lines main}}' } },
      { kind: 'prefs', key: 'prefs', doc: { secondPerson: false } },
      { kind: 'notes', key: 'notes', doc: { text: 'The heist is a front.' } },
    ]);
    expect(settings.codex[0]).toMatchObject({ id: 'loc1', name: 'Hangar' });
    expect(settings.names[3]).toEqual(['Harrison Vale', 'Harrison']);
    expect(settings.rewardTemplate).toBe('{{lines main}}');
    expect(settings.secondPerson).toBe(false);
    expect(settings.notes).toBe('The heist is a front.');
    expect(assembleSettings([]).notes).toBe('');
  });

  it('reads the every-phase reward list', () => {
    const { rewardItems } = assembleSettings([{ kind: 'reward', key: 'g1', doc: { name: 'Partial', group: 'result', text: 'Partial', ops: [{ act: 'inc', tab: 'numbers', entry: 'Rating', by: 1 }], position: 1 } }]);
    expect(rewardItems).toEqual([
      { id: 'g1', scope: 'game', name: 'Partial', group: 'result', text: 'Partial', ops: [{ act: 'inc', tab: 'numbers', entry: 'Rating', by: 1 }], choose: false, position: 1 },
    ]);
  });

  it('gives a codex entry missing its lists empty ones', () => {
    const [entry] = assembleSettings([{ kind: 'codex', key: 'x1', doc: { type: 'Secret', name: 'The heir', secret: true } }]).codex;
    expect(entry).toEqual({
      id: 'x1', type: 'Secret', name: 'The heir', notes: '', secret: true, aliases: [], knownBy: [], phases: [],
    });
  });
});

describe('editing', () => {
  it('lays local edits over the server copy, based on the server version', () => {
    let s = loadState([card('c1', 'old', 1, 4)], 1);
    s = editItem<{ summary: string }>(s, 'card', 'c1', (doc) => ({ ...doc!, summary: 'new' }));
    expect(getDoc(s, 'card', 'c1')).toMatchObject({ summary: 'new' });
    expect(s.dirty[itemId('card', 'c1')].baseVersion).toBe(4);
    expect(s.server[itemId('card', 'c1')].doc).toMatchObject({ summary: 'old' });
  });

  it('a second edit keeps the first edit’s base version', () => {
    let s = loadState([card('c1', 'a', 1, 2)], 1);
    s = editItem(s, 'card', 'c1', () => ({ summary: 'b' }));
    s = editItem(s, 'card', 'c1', () => ({ summary: 'c' }));
    expect(toChangeRequests(dirtyList(s))).toEqual([{ kind: 'card', key: 'c1', base_version: 2, doc: { summary: 'c' } }]);
  });

  it('a new item is based on version 0; recreating a tombstone is based on the tombstone', () => {
    let s = loadState([makeGmItem({ kind: 'stance', key: '1|2', deleted: true, doc: undefined, version: 5 })], 1);
    s = editItem(s, 'stance', '1|2', () => ({ value: 'ally' }));
    s = editItem(s, 'card', 'fresh', () => ({ summary: 'x' }));
    expect(s.dirty[itemId('stance', '1|2')].baseVersion).toBe(5);
    expect(s.dirty[itemId('card', 'fresh')].baseVersion).toBe(0);
  });

  it('deleting an item the server never had just drops the edit', () => {
    let s = loadState([], 0);
    s = editItem(s, 'card', 'fresh', () => ({}));
    s = removeItem(s, 'card', 'fresh');
    expect(hasPendingChanges(s)).toBe(false);
  });

  it('deleting a saved item sends a delete at its version', () => {
    let s = loadState([card('c1', 'x', 1, 3)], 1);
    s = removeItem(s, 'card', 'c1');
    expect(getDoc(s, 'card', 'c1')).toBeUndefined();
    expect(liveItems(s)).toEqual([]);
    expect(toChangeRequests(dirtyList(s))).toEqual([{ kind: 'card', key: 'c1', base_version: 3, deleted: true }]);
  });
});

describe('merging a poll', () => {
  it('never overwrites a dirty local item', () => {
    let s = loadState([card('c1', 'base', 1, 1)], 1);
    s = editItem(s, 'card', 'c1', () => ({ summary: 'mine' }));
    s = mergeServerItems(s, [card('c1', 'theirs', 2, 2), card('c2', 'new from them', 3, 1)], 3);

    expect(getDoc(s, 'card', 'c1')).toEqual({ summary: 'mine' });
    expect(s.dirty[itemId('card', 'c1')].baseVersion).toBe(1); // stale on purpose: the save will conflict
    expect(getDoc(s, 'card', 'c2')).toMatchObject({ summary: 'new from them' });
    expect(s.cursor).toBe(3);
  });

  it('a slow poll can’t undo a newer copy', () => {
    let s = loadState([card('c1', 'saved', 9, 3)], 9);
    s = mergeServerItems(s, [card('c1', 'older', 5, 2)], 9);
    expect(getDoc(s, 'card', 'c1')).toMatchObject({ summary: 'saved' });
  });

  it('learns about deletions from tombstones', () => {
    let s = loadState([card('c1', 'x', 1, 1)], 1);
    s = mergeServerItems(s, [makeGmItem({ kind: 'card', key: 'c1', deleted: true, doc: undefined, seq: 2, version: 2 })], 2);
    expect(liveItems(s)).toEqual([]);
  });

  it('never moves the cursor backwards', () => {
    const s = mergeServerItems(loadState([], 10), [], 4);
    expect(s.cursor).toBe(10);
  });
});

describe('saving', () => {
  it('clears edits that didn’t change while the save was in flight', () => {
    let s = loadState([], 0);
    s = editItem(s, 'notes', 'notes', () => ({ text: 'hi' }));
    const sent = dirtyList(s);
    s = markSaved(s, sent, [makeGmItem({ kind: 'notes', key: 'notes', version: 1, seq: 4, doc: { text: 'hi' } })]);
    expect(hasPendingChanges(s)).toBe(false);
    expect(getDoc(s, 'notes', 'notes')).toEqual({ text: 'hi' });
  });

  it('keeps an edit made during the save dirty, now based on the version just written', () => {
    let s = loadState([], 0);
    s = editItem(s, 'notes', 'notes', () => ({ text: 'h' }));
    const sent = dirtyList(s);
    s = editItem(s, 'notes', 'notes', () => ({ text: 'hello' }));
    s = markSaved(s, sent, [makeGmItem({ kind: 'notes', key: 'notes', version: 1, seq: 4, doc: { text: 'h' } })]);

    expect(getDoc(s, 'notes', 'notes')).toEqual({ text: 'hello' });
    expect(toChangeRequests(dirtyList(s))).toEqual([{ kind: 'notes', key: 'notes', base_version: 1, doc: { text: 'hello' } }]);
  });
});

describe('a 409', () => {
  it('replaces only the conflicting items and keeps the rest dirty', () => {
    let s = loadState([card('c1', 'base', 1, 1), card('c2', 'base', 2, 1)], 2);
    s = editItem(s, 'card', 'c1', () => ({ summary: 'mine' }));
    s = editItem(s, 'card', 'c2', () => ({ summary: 'also mine' }));
    s = applyConflicts(s, [card('c1', 'theirs', 7, 2)]);

    expect(getDoc(s, 'card', 'c1')).toMatchObject({ summary: 'theirs' });
    expect(getDoc(s, 'card', 'c2')).toEqual({ summary: 'also mine' });
    expect(Object.keys(s.dirty)).toEqual([itemId('card', 'c2')]);
    expect(s.lost.map((l) => l.key)).toEqual(['c1']);
  });

  it('“Use mine” puts the lost edit back, based on their version', () => {
    let s = loadState([card('c1', 'base', 1, 1)], 1);
    s = editItem(s, 'card', 'c1', () => ({ summary: 'mine' }));
    s = applyConflicts(s, [card('c1', 'theirs', 7, 2)]);
    s = reapplyLost(s, s.lost[0]);

    expect(s.lost).toEqual([]);
    expect(getDoc(s, 'card', 'c1')).toEqual({ summary: 'mine' });
    expect(s.dirty[itemId('card', 'c1')].baseVersion).toBe(2);
  });

  // Regression: two GMs opening a board both wrote the same derived value
  // (the reward carrier) from the same version, and the second was told
  // someone else had changed what they were editing.
  it('an edit the other editor already made is not a conflict: their copy stands and nothing is lost', () => {
    let s = loadState([card('c1', 'base', 1, 1)], 1);
    s = editItem(s, 'card', 'c1', () => ({ summary: 'same', characterId: 3 }));
    // The database's key order isn't ours.
    s = applyConflicts(s, [makeGmItem({ kind: 'card', key: 'c1', version: 2, seq: 7, doc: { characterId: 3, summary: 'same' } })]);

    expect(s.lost).toEqual([]);
    expect(hasPendingChanges(s)).toBe(false);
    expect(s.server[itemId('card', 'c1')].version).toBe(2);
  });

  it('a delete the other editor already made is not a conflict either', () => {
    let s = loadState([card('c1', 'base', 1, 1)], 1);
    s = removeItem(s, 'card', 'c1');
    s = applyConflicts(s, [makeGmItem({ kind: 'card', key: 'c1', version: 2, seq: 7, deleted: true, doc: undefined })]);

    expect(s.lost).toEqual([]);
    expect(hasPendingChanges(s)).toBe(false);
  });

  it('an item that turned out not to exist is dropped from our copy', () => {
    let s = loadState([card('c1', 'x', 1, 1)], 1);
    s = editItem(s, 'card', 'c1', () => ({ summary: 'y' }));
    s = applyConflicts(s, [makeGmItem({ kind: 'card', key: 'c1', version: 0, seq: 0, deleted: true, doc: undefined })]);
    expect(s.server[itemId('card', 'c1')]).toBeUndefined();
    expect(getDoc(s, 'card', 'c1')).toBeUndefined();
  });
});

describe('newItemKey', () => {
  it('sorts keys in the order they were made, and fits the server’s key rule', () => {
    const first = newItemKey('card', 1_000, () => 0.9);
    const second = newItemKey('card', 2_000, () => 0.1);
    expect(first < second).toBe(true);
    expect(second).toMatch(/^card-[a-z0-9]{14}$/);
    expect(newItemKey('card', 1_000, () => 0.1)).not.toBe(newItemKey('card', 1_000, () => 0.2));
  });
});
