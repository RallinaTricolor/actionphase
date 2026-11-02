import { describe, it, expect } from 'vitest';
import { makeBoard, makeCard } from '@/test-utils/factories';
import { autoLabel, cardLabel, isIF, isWaiting, needsCause, newCard, nextChunkId, OUTCOMES, splitCard, textField } from './cards';

const chunks = makeBoard().chunks;

describe('labels', () => {
  it('uses the first sentence of a quote, after any section headers and bullets', () => {
    expect(autoLabel('Plan: • I sneak into the vault at midnight. Then I wait for the guard.')).toBe(
      'I sneak into the vault at midnight.',
    );
  });

  it('keeps the whole quote when its first sentence is too long or too short', () => {
    expect(autoLabel('Go. Then run as fast as I can')).toBe('Go. Then run as fast as I can');
    const long = `I ${'really '.repeat(20)}want this.`;
    expect(autoLabel(long)).toBe(long);
  });

  it('prefers the summary, then the quote, then a placeholder', () => {
    expect(cardLabel(makeCard({ id: 'c', characterId: 1, summary: 'Steal the key', quote: 'x' }))).toBe('Steal the key');
    expect(cardLabel(makeCard({ id: 'c', characterId: 1, quote: 'I steal the key from the desk. Then hide.' }))).toBe(
      'I steal the key from the desk.',
    );
    expect(cardLabel(makeCard({ id: 'c', characterId: 1 }))).toBe('GM card');
  });
});

describe('IF cards and outcomes', () => {
  it('counts a card as IF when flagged, with a condition, or as a branch', () => {
    expect(isIF(makeCard({ id: 'c', characterId: 1 }))).toBe(false);
    expect(isIF(makeCard({ id: 'c', characterId: 1, isIF: true }))).toBe(true);
    expect(isIF(makeCard({ id: 'c', characterId: 1, cond: 'the alarm sounds' }))).toBe(true);
    expect(isIF(makeCard({ id: 'c', characterId: 1, branchOf: 'c0' }))).toBe(true);
  });

  it('waits in Contingencies only with no time slot', () => {
    expect(isWaiting(makeCard({ id: 'c', characterId: 1, chunkId: null }))).toBe(true);
    expect(isWaiting(makeCard({ id: 'c', characterId: 1, chunkId: 'k1' }))).toBe(false);
  });

  it('labels outcomes with the board’s words', () => {
    expect(OUTCOMES.map((o) => o.label)).toEqual(['Unresolved', 'Happened', 'Partly', 'Failed', 'Interrupted', 'Moot']);
  });

  it('asks for a cause on every outcome but Unresolved and Happened', () => {
    expect(needsCause('pending')).toBe(false);
    expect(needsCause('happened')).toBe(false);
    expect(['partial', 'failed', 'interrupted', 'moot'].every((o) => needsCause(o as never))).toBe(true);
  });

  it('starts a new card unresolved with no causes', () => {
    const c = newCard({ id: 'c9', characterId: 4, locationId: 'loc-dock', chunkId: null, isIF: true, cond: 'if seen' });
    expect(c).toMatchObject({ outcome: 'pending', causedBy: [], chunkId: null, isIF: true, quote: '', summary: '', gm: false });
  });
});

describe('splitCard', () => {
  const quoteCard = makeCard({
    id: 'c1',
    characterId: 3,
    quote: 'I plant the sword in the shrine. Later I launch the boat.',
    summary: 'Sword and boat',
    note: 'check the tide',
    locationId: 'loc-shrine',
    chunkId: 'k1',
    outcome: 'happened',
    causedBy: ['c0'],
    cond: 'if the priest leaves',
    src: [2, 3],
  });
  const at = quoteCard.quote.indexOf('Later');

  it('keeps the text before the cursor and moves the rest to a new card in the next slot', () => {
    const out = splitCard(quoteCard, at, chunks, 'c2');
    expect(out?.kept).toMatchObject({ id: 'c1', quote: 'I plant the sword in the shrine.', summary: 'Sword and boat', outcome: 'happened' });
    expect(out?.added).toMatchObject({
      id: 'c2',
      characterId: 3,
      quote: 'Later I launch the boat.',
      summary: '',
      note: '',
      locationId: 'loc-shrine',
      chunkId: 'k2',
      outcome: 'pending',
      causedBy: [],
      cond: 'if the priest leaves',
      src: [2, 3],
    });
  });

  it('splits a GM card’s summary, and the new card is a GM card too', () => {
    const gm = makeCard({ id: 'c1', characterId: 3, gm: true, summary: 'Stuck in the cellar, then freed', chunkId: 'k2' });
    expect(textField(gm)).toBe('summary');
    const out = splitCard(gm, gm.summary.indexOf('then'), chunks, 'c2');
    expect(out?.kept.summary).toBe('Stuck in the cellar,');
    expect(out?.added).toMatchObject({ summary: 'then freed', quote: '', chunkId: 'k3', gm: true });
  });

  it('keeps a waiting IF card’s split waiting', () => {
    const waiting = { ...quoteCard, chunkId: null };
    expect(splitCard(waiting, at, chunks, 'c2')?.added.chunkId).toBeNull();
  });

  it('puts the split of a card in the last slot in that same slot', () => {
    expect(splitCard({ ...quoteCard, chunkId: 'k3' }, at, chunks, 'c2')?.added.chunkId).toBe('k3');
  });

  it('refuses to split at either end of the text, or where one side is only spaces', () => {
    expect(splitCard(quoteCard, 0, chunks, 'c2')).toBeNull();
    expect(splitCard(quoteCard, quoteCard.quote.length, chunks, 'c2')).toBeNull();
    const padded = { ...quoteCard, quote: '   I wait.' };
    expect(splitCard(padded, 2, chunks, 'c2')).toBeNull();
  });

  it('finds the next slot by position, not list order', () => {
    const shuffled = [chunks[2], chunks[0], chunks[1]];
    expect(nextChunkId(shuffled, 'k1')).toBe('k2');
  });
});
