import { describe, it, expect } from 'vitest';
import { makeBoard, makeCard, makeCodexEntry, makeScene } from '@/test-utils/factories';
import {
  boardRows,
  causeCandidates,
  cardsCiting,
  dropCard,
  isChunkEmpty,
  laterCardCount,
  locationAt,
  NO_LOCATION,
  nextSlotName,
  positionAtEnd,
  positionBefore,
  presentInChunk,
  pushLater,
  rowIdOf,
  suggestClusters,
} from './map';

// makeBoard's slots: k1 Pre-Scenario (1), k2 Slot 1 (2), k3 Slot 2 (3).
const PHASE = 70;
const hall = makeCodexEntry({ id: 'loc-hall', type: 'Location', name: 'the hall', aliases: ['hall'] });
const roof = makeCodexEntry({ id: 'loc-roof', type: 'Location', name: 'roof', phases: [PHASE] });
const cellar = makeCodexEntry({ id: 'loc-cellar', type: 'Location', name: 'cellar', phases: [69] });
const vault = makeCodexEntry({ id: 'loc-vault', type: 'Location', name: 'vault', phases: [68] });
const ledger = makeCodexEntry({ id: 'item-ledger', type: 'Item', name: 'ledger' });

describe('boardRows', () => {
  it('lists the phase’s locations', () => {
    expect(boardRows([hall, ledger, roof, cellar], PHASE, []).map((r) => [r.id, r.kind])).toEqual([
      ['loc-hall', 'phase'],
      ['loc-roof', 'phase'],
    ]);
  });

  it('keeps another phase’s location while a card uses it, and gathers cards whose location is gone', () => {
    const cards = [{ locationId: 'loc-cellar' }, { locationId: 'deleted' }, { locationId: 'item-ledger' }];
    const rows = boardRows([hall, cellar, vault, ledger], PHASE, cards);
    expect(rows.map((r) => [r.id, r.kind])).toEqual([
      ['loc-hall', 'phase'],
      ['loc-cellar', 'other'],
      [NO_LOCATION, 'missing'],
    ]);
    expect(rowIdOf({ locationId: 'deleted' }, rows)).toBe(NO_LOCATION);
    expect(rowIdOf({ locationId: 'item-ledger' }, rows)).toBe(NO_LOCATION);
    expect(rowIdOf({ locationId: 'loc-cellar' }, rows)).toBe('loc-cellar');
  });
});

describe('time slots', () => {
  const { chunks } = makeBoard();

  it('inserts before a slot at the midpoint, or before the first', () => {
    expect(positionBefore(chunks, 0)).toBe(0);
    expect(positionBefore(chunks, 2)).toBe(2.5);
    expect(positionBefore(chunks, 9)).toBe(4);
    expect(positionAtEnd([])).toBe(1);
  });

  it('names a new slot after the slots already there, skipping taken names', () => {
    expect(nextSlotName(chunks)).toBe('Slot 3');
    expect(nextSlotName([...chunks, { id: 'x', name: 'slot 3', position: 9 }])).toBe('Slot 4');
    expect(nextSlotName([])).toBe('Slot 1');
  });

  it('counts a slot as empty with no cards or scenes', () => {
    const board = makeBoard({ cards: [makeCard({ id: 'c', characterId: 1, chunkId: 'k2' })], scenes: [makeScene({ id: 's', chunkId: 'k3' })] });
    expect(isChunkEmpty(board, 'k1')).toBe(true);
    expect(isChunkEmpty(board, 'k2')).toBe(false);
    expect(isChunkEmpty(board, 'k3')).toBe(false);
  });
});

describe('pushLater', () => {
  const added = { id: 'new', name: 'Slot 3' };

  it('moves the character’s later cards one slot, leaving this one and other people’s', () => {
    const board = makeBoard({
      cards: [
        makeCard({ id: 'here', characterId: 1, chunkId: 'k1' }),
        makeCard({ id: 'next', characterId: 1, chunkId: 'k2' }),
        makeCard({ id: 'theirs', characterId: 2, chunkId: 'k2' }),
        makeCard({ id: 'waiting', characterId: 1, chunkId: null, isIF: true }),
      ],
    });
    expect(pushLater(board, 'here', added)).toEqual({ moves: [{ cardId: 'next', chunkId: 'k3' }], addedChunk: null });
    expect(laterCardCount(board, board.cards[0])).toBe(1);
  });

  it('adds a slot at the end when a card is already in the last one', () => {
    const board = makeBoard({
      cards: [makeCard({ id: 'here', characterId: 1, chunkId: 'k1' }), makeCard({ id: 'last', characterId: 1, chunkId: 'k3' })],
    });
    expect(pushLater(board, 'here', added)).toEqual({
      moves: [{ cardId: 'last', chunkId: 'new' }],
      addedChunk: { id: 'new', name: 'Slot 3', position: 4 },
    });
  });

  it('does nothing with no later cards, or for a waiting card', () => {
    const board = makeBoard({ cards: [makeCard({ id: 'here', characterId: 1, chunkId: 'k3' }), makeCard({ id: 'w', characterId: 1, chunkId: null })] });
    expect(pushLater(board, 'here', added)).toBeNull();
    expect(pushLater(board, 'w', added)).toBeNull();
    expect(laterCardCount(board, board.cards[1])).toBe(0);
  });
});

describe('causeCandidates', () => {
  it('offers the same cell, the rest of the slot, then the slot before', () => {
    const card = makeCard({ id: 'me', characterId: 1, chunkId: 'k2', locationId: 'loc-hall' });
    const board = makeBoard({
      cards: [
        card,
        makeCard({ id: 'cell', characterId: 2, chunkId: 'k2', locationId: 'loc-hall' }),
        makeCard({ id: 'away', characterId: 2, chunkId: 'k2', locationId: 'loc-roof' }),
        makeCard({ id: 'before', characterId: 3, chunkId: 'k1', locationId: 'loc-roof' }),
        makeCard({ id: 'after', characterId: 3, chunkId: 'k3' }),
      ],
      scenes: [makeScene({ id: 'fight', chunkId: 'k2', locationId: 'loc-hall' })],
    });
    expect(causeCandidates(board, card)).toEqual([
      { kind: 'same', chunkId: 'k2', items: [{ id: 'fight', scene: true }, { id: 'cell', scene: false }] },
      { kind: 'elsewhere', chunkId: 'k2', items: [{ id: 'away', scene: false }] },
      { kind: 'before', chunkId: 'k1', items: [{ id: 'before', scene: false }] },
    ]);
  });

  it('keeps a cause picked earlier that has since moved away, and drops ones that are gone', () => {
    const card = makeCard({ id: 'me', characterId: 1, chunkId: 'k1', causedBy: ['after', 'deleted'] });
    const board = makeBoard({ cards: [card, makeCard({ id: 'after', characterId: 2, chunkId: 'k3' })] });
    expect(causeCandidates(board, card)).toEqual([{ kind: 'chosen', chunkId: null, items: [{ id: 'after', scene: false }] }]);
  });
});

describe('cardsCiting', () => {
  it('takes a deleted card out of other cards’ causes and alternatives', () => {
    const cards = [
      makeCard({ id: 'gone', characterId: 1 }),
      makeCard({ id: 'a', characterId: 2, causedBy: ['gone', 'x'] }),
      makeCard({ id: 'b', characterId: 2, branchOf: 'gone' }),
      makeCard({ id: 'c', characterId: 2, causedBy: ['x'] }),
    ];
    expect(cardsCiting(cards, 'gone').map((c) => [c.id, c.causedBy, c.branchOf])).toEqual([
      ['a', ['x'], null],
      ['b', [], null],
    ]);
  });
});

describe('dropCard', () => {
  const card = makeCard({ id: 'c', characterId: 1, chunkId: 'k1' });
  const waiting = makeCard({ id: 'w', characterId: 1, chunkId: null, isIF: true });

  it('moves a card to a cell, and says when a waiting IF card triggers', () => {
    expect(dropCard(card, { chunkId: 'k2', locationId: 'loc-roof' })).toEqual({
      ok: true, fields: { chunkId: 'k2', locationId: 'loc-roof' }, triggered: false,
    });
    expect(dropCard(waiting, { chunkId: 'k2', characterId: 1 })).toEqual({ ok: true, fields: { chunkId: 'k2' }, triggered: true });
    expect(dropCard(makeCard({ ...card, isIF: true }), { chunkId: null })).toEqual({ ok: true, fields: { chunkId: null }, triggered: false });
  });

  it('refuses another character’s row, Contingencies for a plain card, and the No location row', () => {
    expect(dropCard(card, { chunkId: 'k2', characterId: 2 })).toEqual({ ok: false, reason: 'other-character' });
    expect(dropCard(card, { chunkId: null })).toEqual({ ok: false, reason: 'not-if' });
    expect(dropCard(card, { chunkId: 'k2', locationId: NO_LOCATION })).toEqual({ ok: false, reason: 'no-location' });
  });
});

describe('who is where', () => {
  const board = makeBoard({
    cards: [
      makeCard({ id: 'a', characterId: 1, chunkId: 'k1', locationId: 'loc-roof' }),
      makeCard({ id: 'm', characterId: 2, chunkId: 'k2', outcome: 'moot' }),
      makeCard({ id: 'b', characterId: 3, chunkId: 'k2', locationId: 'loc-hall' }),
    ],
    scenes: [makeScene({ id: 's', chunkId: 'k2', locationId: 'loc-dock', participants: [1, 4] })],
  });

  it('lists who is in a slot: live cards and scene casts', () => {
    expect([...presentInChunk(board, 'k2')].sort()).toEqual([1, 3, 4]);
  });

  it('finds where someone was last seen by a slot', () => {
    expect(locationAt(board, 1, 0)).toBe('loc-roof');
    expect(locationAt(board, 1, 2)).toBe('loc-dock');
    expect(locationAt(board, 2, 2)).toBeNull();
  });

  it('groups players who share a cell, biggest first', () => {
    const shared = makeBoard({
      cards: [
        makeCard({ id: 'a', characterId: 1, chunkId: 'k1', locationId: 'loc-hall' }),
        makeCard({ id: 'b', characterId: 2, chunkId: 'k1', locationId: 'loc-hall' }),
        makeCard({ id: 'c', characterId: 2, chunkId: 'k2', locationId: 'loc-roof' }),
        makeCard({ id: 'd', characterId: 3, chunkId: 'k2', locationId: 'loc-roof' }),
        makeCard({ id: 'e', characterId: 4, chunkId: 'k2', locationId: 'loc-roof', outcome: 'moot' }),
        makeCard({ id: 'f', characterId: 9, chunkId: 'k1', locationId: 'loc-hall' }),
      ],
    });
    expect(suggestClusters(shared, [1, 2, 3, 4])).toEqual([[1, 2, 3], [4]]);
  });
});
