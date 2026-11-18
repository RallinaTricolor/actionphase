/**
 * Cards: one thing a character plans or does in a phase, placed in a time
 * slot (chunk) and a location. Labels, IF cards, outcomes and splitting.
 */

import { escapeRegExp, plainText } from './text';
import type { Card, Chunk, Outcome } from './types';

export const OUTCOMES: { value: Outcome; label: string; tone: 'neutral' | 'success' | 'warning' | 'danger' }[] = [
  { value: 'pending', label: 'Unresolved', tone: 'neutral' },
  { value: 'happened', label: 'Happened', tone: 'success' },
  { value: 'partial', label: 'Partly', tone: 'warning' },
  { value: 'failed', label: 'Failed', tone: 'danger' },
  { value: 'interrupted', label: 'Interrupted', tone: 'danger' },
  { value: 'moot', label: 'Moot', tone: 'neutral' },
];

/** These outcomes ask "Because of…" a card or scene. */
export const needsCause = (outcome: Outcome) =>
  outcome === 'partial' || outcome === 'failed' || outcome === 'interrupted' || outcome === 'moot';

/**
 * A label for a quote: its first sentence, after any "Section:" headers or
 * bullets the player wrote in front of it. Long first sentences give the
 * whole quote back, so nothing is cut mid-thought.
 */
export function autoLabel(quote: string): string {
  let t = plainText(quote).replace(/\s+/g, ' ').trim();
  for (let i = 0; i < 3; i++) {
    t = t.replace(/^[•\-*–\s]+/, '');
    const m = t.match(/^([^:.!?•]{2,40}):\s*(?=\S)/);
    if (m && t.length > m[0].length + 8) t = t.slice(m[0].length);
    else break;
  }
  t = t.replace(/^[•\-*–\s]+/, '').replace(/\s*•\s*/g, ' · ');
  const s = t.match(/^(.{16,}?[.!?])(\s|$)/);
  return s && s[1].length <= 120 ? s[1] : t;
}

/** What the board shows for a card: its label, else its quote's first sentence. */
export const cardLabel = (card: Card) => card.summary || (card.quote ? autoLabel(card.quote) : '') || 'GM card';

/**
 * The label on the Map, where the card already shows its character: a
 * leading name ("Mara's", "Mara") is dropped, unless little would be left.
 */
export function boardLabel(card: Card, names: string[]): string {
  const label = cardLabel(card);
  for (const name of [...new Set(names)].filter(Boolean).sort((a, b) => b.length - a.length)) {
    const m = label.match(new RegExp(`^${escapeRegExp(name)}(?:['’]s)?\\s+(?=\\S)`));
    if (m && label.length > m[0].length + 4) {
      const rest = label.slice(m[0].length);
      return rest[0].toUpperCase() + rest.slice(1);
    }
  }
  return label;
}

/** The IF condition to show beside a card's label: none when the label already says it. */
export function shownCondition(card: Card, label: string): string {
  const cond = card.cond.trim();
  return isIF(card) && cond && !label.toLowerCase().includes(cond.toLowerCase()) ? cond : '';
}

export const isIF = (card: Card) => card.isIF || !!card.cond || !!card.branchOf;

/** An IF card with no time slot waits in Contingencies. One still waiting at the end counts as moot. */
export const isWaiting = (card: Card) => card.chunkId === null;

/**
 * The field that holds a card's text: the quote for a card made from a
 * submission, the summary for a card the GM wrote. On a quote card the summary
 * is an optional label.
 */
export const textField = (card: Card): 'quote' | 'summary' => (card.quote ? 'quote' : 'summary');

/** A new card with no outcome or causes. An IF card passes `chunkId: null` to wait in Contingencies. */
export function newCard(
  fields: Partial<Card> & Pick<Card, 'id' | 'characterId' | 'locationId' | 'chunkId'>,
): Card {
  return {
    quote: '',
    summary: '',
    note: '',
    outcome: 'pending',
    causedBy: [],
    isIF: false,
    cond: '',
    branchOf: null,
    src: [],
    gm: false,
    ...fields,
  };
}

/** The chunk after `chunkId` in time order; the last chunk has no later one, so it gives itself. */
export function nextChunkId(chunks: Chunk[], chunkId: string): string {
  const sorted = [...chunks].sort((a, b) => a.position - b.position);
  const i = sorted.findIndex((c) => c.id === chunkId);
  return i >= 0 && i + 1 < sorted.length ? sorted[i + 1].id : chunkId;
}

/**
 * Splits a card's text at `at` (a cursor position in `textField(card)`). The
 * text before stays on the card. The text after becomes a new card with the
 * same character, location, source paragraphs and IF condition, in the next
 * time slot (a waiting card's split also waits), with no outcome, causes or
 * note. Returns null when either side would be empty.
 */
export function splitCard(card: Card, at: number, chunks: Chunk[], newId: string): { kept: Card; added: Card } | null {
  const field = textField(card);
  const text = card[field];
  const before = text.slice(0, at).trimEnd();
  const after = text.slice(at).trimStart();
  if (!before || !after) return null;
  const kept: Card = { ...card, [field]: before };
  const added: Card = {
    ...card,
    id: newId,
    quote: field === 'quote' ? after : '',
    summary: field === 'summary' ? after : '',
    note: '',
    chunkId: card.chunkId === null ? null : nextChunkId(chunks, card.chunkId),
    outcome: 'pending',
    causedBy: [],
    src: [...card.src],
  };
  return { kept, added };
}

/** A card as its stored item's doc: everything but the id, which is the item's key. */
export function cardDoc(card: Card): Omit<Card, 'id'> {
  const doc: Partial<Card> = { ...card };
  delete doc.id;
  return doc as Omit<Card, 'id'>;
}
