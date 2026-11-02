/**
 * The Read step's logic: a submission split into paragraphs, what it names,
 * where card text sits in it, and where a new card from it goes. Plain word
 * rules, no AI. The DOM work (walking rendered text, painting highlights)
 * lives in the components; everything it computes is here.
 */

import { escapeRegExp, plainText } from './text';
import type { BoardDoc, Card, Chunk, CodexEntry } from './types';

// ------------------------------------------------------------------ paragraphs

export interface Block {
  kind: 'p' | 'li' | 'h' | 'hr';
  /** The block's markdown, as the player wrote it (renderable on its own). */
  source: string;
  /** Its words without list markers or heading hashes. Empty for a rule. */
  text: string;
  /** Paragraph and list lines are numbered from 0: a card's `src` holds these. Headings and rules have none. */
  index: number | null;
}

/**
 * Splits a submission into the blocks the GM cards: paragraphs and list lines,
 * plus headings and rules for display. A fenced code block stays one
 * paragraph, blank lines and all.
 */
export function submissionBlocks(markdown: string): Block[] {
  const lines = String(markdown || '').replace(/\r/g, '').split('\n');
  const out: Omit<Block, 'index'>[] = [];
  let para: string[] = [];
  let fence: string[] | null = null;
  const flush = () => {
    if (!para.length) return;
    out.push({ kind: 'p', source: para.join('\n'), text: para.map((l) => l.trim()).join('\n') });
    para = [];
  };

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '');
    if (fence) {
      fence.push(line);
      if (/^\s{0,3}```/.test(line)) {
        const source = fence.join('\n');
        out.push({ kind: 'p', source, text: fence.slice(1, -1).join('\n') });
        fence = null;
      }
      continue;
    }
    if (/^\s{0,3}```/.test(line)) {
      flush();
      fence = [line];
      continue;
    }
    if (!line.trim()) {
      flush();
      continue;
    }
    if (/^\s{0,3}([-*_])(\s*\1){2,}\s*$/.test(line)) {
      flush();
      out.push({ kind: 'hr', source: line, text: '' });
      continue;
    }
    let m = line.match(/^\s{0,3}#{1,6}\s+(.*)$/);
    if (m) {
      flush();
      out.push({ kind: 'h', source: line, text: m[1].replace(/\s#+$/, '') });
      continue;
    }
    m = line.match(/^\s*(?:[-*+]|\d+[.)])\s+(.*)$/);
    if (m) {
      flush();
      out.push({ kind: 'li', source: line, text: m[1] });
      continue;
    }
    para.push(line);
  }
  if (fence) out.push({ kind: 'p', source: fence.join('\n'), text: fence.slice(1).join('\n') });
  flush();

  let n = 0;
  return out.map((b) => ({ ...b, index: b.kind === 'p' || b.kind === 'li' ? n++ : null }));
}

/** Words only, lower case, single spaces: what "the same text" means when matching quotes to paragraphs. */
const normalize = (t: string) =>
  plainText(t)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/**
 * How many of the owner's cards came from each paragraph: a card counts for a
 * paragraph it names in `src`, or whose text overlaps the paragraph's (so a
 * card made before the paragraphs moved still counts).
 */
export function paragraphCardCounts(blocks: Block[], cards: Card[], ownerId: number): Record<number, number> {
  const quotes = cards
    .filter((c) => c.characterId === ownerId && c.quote)
    .map((c) => ({ src: c.src, n: normalize(c.quote) }));
  const counts: Record<number, number> = {};
  for (const b of blocks) {
    if (b.index === null) continue;
    const n = normalize(b.text);
    const head = n.slice(0, 60);
    const index = b.index;
    counts[index] =
      n.length < 3
        ? 0
        : quotes.filter((q) => q.src.includes(index) || (q.n.length >= 12 && (q.n.includes(head) || n.includes(q.n.slice(0, 60)))))
            .length;
  }
  return counts;
}

// ------------------------------------------------------------------ names and codex

export interface NamedCharacter {
  id: number;
  /** The names the board matches them by (see `characterNames`). */
  names: string[];
}

type MatchTag = { kind: 'name'; characterId: number } | { kind: 'codex'; entryId: string };

export interface Match {
  start: number;
  end: number;
  tag: MatchTag;
}

/** Sheet references (`[[name|kind:id]]`) are the sheet's, not names or codex terms. */
const SHEET_REF = /\[\[[^\]]*\]\]/g;

/**
 * Every character name and codex term in `text`, longest first so "the Old
 * Mill" wins over "Mill". Character names match case-sensitively (an @ in
 * front is fine); codex terms in any case. Terms shorter than two characters
 * are skipped. Matches never overlap, and names win over codex terms.
 */
export function findMatches(text: string, characters: NamedCharacter[], codex: CodexEntry[]): Match[] {
  const blanked = text.replace(SHEET_REF, (s) => ' '.repeat(s.length));
  const names = characters
    .flatMap((c) => c.names.map((t) => ({ t: String(t).trim(), characterId: c.id })))
    .filter((x) => x.t.length >= 2)
    .sort((a, b) => b.t.length - a.t.length);
  const terms = codex
    .flatMap((e) => [e.name, ...e.aliases].map((t) => ({ t: String(t).trim(), entryId: e.id })))
    .filter((x) => x.t.length >= 2)
    .sort((a, b) => b.t.length - a.t.length);

  const out: Match[] = [];
  const taken = (start: number, end: number) => out.some((m) => start < m.end && end > m.start);
  if (names.length) {
    const re = new RegExp(`(?<![\\w@])@?(${names.map((x) => escapeRegExp(x.t)).join('|')})(?![\\w])`, 'g');
    for (const m of blanked.matchAll(re)) {
      const hit = names.find((x) => x.t === m[1]);
      if (hit) out.push({ start: m.index, end: m.index + m[0].length, tag: { kind: 'name', characterId: hit.characterId } });
    }
  }
  if (terms.length) {
    const re = new RegExp(`(?<![\\w])(${terms.map((x) => escapeRegExp(x.t)).join('|')})(?![\\w])`, 'gi');
    for (const m of blanked.matchAll(re)) {
      const lc = m[1].toLowerCase();
      const hit = terms.find((x) => x.t.toLowerCase() === lc);
      const end = m.index + m[0].length;
      if (hit && !taken(m.index, end)) out.push({ start: m.index, end, tag: { kind: 'codex', entryId: hit.entryId } });
    }
  }
  return out.sort((a, b) => a.start - b.start);
}

export interface SubmissionRefs {
  /** Other characters it names, in the order they first appear. */
  mentions: number[];
  /** Codex entries it names, in the order they first appear. */
  codexIds: string[];
}

/** Who and what a submission names. The owner naming themselves doesn't count. */
export function submissionRefs(text: string, ownerId: number, characters: NamedCharacter[], codex: CodexEntry[]): SubmissionRefs {
  const refs: SubmissionRefs = { mentions: [], codexIds: [] };
  for (const m of findMatches(text, characters, codex)) {
    if (m.tag.kind === 'name') {
      if (m.tag.characterId !== ownerId && !refs.mentions.includes(m.tag.characterId)) refs.mentions.push(m.tag.characterId);
    } else if (!refs.codexIds.includes(m.tag.entryId)) {
      refs.codexIds.push(m.tag.entryId);
    }
  }
  return refs;
}

export interface Submission {
  characterId: number;
  text: string;
}

export interface SubmissionLinks extends SubmissionRefs {
  /** Other submitters whose submission names the owner. */
  mentionedBy: number[];
  /** Other submitters who name none of the same people, but name one of the owner's locations. */
  samePlace: { characterId: number; locationIds: string[] }[];
}

/**
 * How one submission connects to the rest of the phase: who it names, who
 * names its owner, and who will be in the same place without either naming
 * the other (the player a GM is most likely to leave out of a scene).
 */
export function submissionLinks(
  submissions: Submission[],
  ownerId: number,
  characters: NamedCharacter[],
  codex: CodexEntry[],
): SubmissionLinks {
  const refsOf = new Map(submissions.map((s) => [s.characterId, submissionRefs(s.text, s.characterId, characters, codex)]));
  const mine = refsOf.get(ownerId) ?? { mentions: [], codexIds: [] };
  const locationIds = new Set(codex.filter((e) => e.type === 'Location').map((e) => e.id));
  const myPlaces = mine.codexIds.filter((id) => locationIds.has(id));

  const mentionedBy: number[] = [];
  const samePlace: SubmissionLinks['samePlace'] = [];
  for (const s of submissions) {
    if (s.characterId === ownerId) continue;
    const theirs = refsOf.get(s.characterId)!;
    if (theirs.mentions.includes(ownerId)) mentionedBy.push(s.characterId);
    else if (!mine.mentions.includes(s.characterId)) {
      const shared = theirs.codexIds.filter((id) => myPlaces.includes(id));
      if (shared.length) samePlace.push({ characterId: s.characterId, locationIds: shared });
    }
  }
  return { ...mine, mentionedBy, samePlace };
}

// ------------------------------------------------------------------ card text in rendered text

export interface FlatText {
  /** The rendered text with runs of whitespace collapsed to one space. */
  flat: string;
  /** For each character of `flat`: [which input string, offset in it]. */
  map: [number, number][];
}

/**
 * Joins the text nodes of a rendered submission into one string a quote can
 * be searched in, collapsing whitespace, and remembers where each character
 * came from so a match can be turned back into a DOM range.
 */
export function flattenText(parts: string[]): FlatText {
  let flat = '';
  const map: [number, number][] = [];
  let space = true;
  parts.forEach((part, p) => {
    for (let i = 0; i < part.length; i++) {
      const ws = /\s/.test(part[i]);
      if (ws && space) continue;
      flat += ws ? ' ' : part[i];
      map.push([p, i]);
      space = ws;
    }
    if (!space) {
      flat += ' ';
      map.push([p, part.length]);
      space = true;
    }
  });
  return { flat, map };
}

/**
 * The position in the flattened text of offset `offset` in input string
 * `part` (a click in the rendered text): the first kept character at or after
 * it, else the part's last. -1 when the part kept nothing.
 */
export function flatIndexAt(map: FlatText['map'], part: number, offset: number): number {
  let last = -1;
  for (let i = 0; i < map.length; i++) {
    if (map[i][0] !== part) continue;
    if (map[i][1] >= offset) return i;
    last = i;
  }
  return last;
}

/** Lower case, one character for one, so offsets still line up with the original. */
const lowerSameLength = (s: string) =>
  Array.from(s, (c) => {
    const l = c.toLowerCase();
    return l.length === c.length ? l : c;
  }).join('');

export interface CardedSpan {
  start: number;
  end: number;
  cardId: string;
}

/**
 * Where each of the owner's quote cards sits in the flattened text, in any
 * case. A quote the GM has edited may no longer match in full; its first 60
 * characters still find it. A card whose text isn't there at all is skipped
 * (its paragraph count still shows it).
 */
export function cardedSpans(flat: string, cards: Card[], ownerId: number): CardedSpan[] {
  const hay = lowerSameLength(flat);
  const out: CardedSpan[] = [];
  for (const c of cards) {
    if (c.characterId !== ownerId || !c.quote) continue;
    const q = lowerSameLength(plainText(c.quote).replace(/\s+/g, ' ').trim());
    if (q.length < 3) continue;
    let at = hay.indexOf(q);
    let len = q.length;
    if (at < 0) {
      const head = q.slice(0, 60);
      at = hay.indexOf(head);
      len = head.length;
    }
    if (at >= 0) out.push({ start: at, end: at + len, cardId: c.id });
  }
  return out;
}

/** The card under a point in the text: the shortest span covering it, so a card inside a longer one stays clickable. */
export function cardAt(spans: CardedSpan[], offset: number): string | null {
  const hits = spans.filter((s) => offset >= s.start && offset < s.end).sort((a, b) => a.end - a.start - (b.end - b.start));
  return hits[0]?.cardId ?? null;
}

// ------------------------------------------------------------------ new cards

/**
 * The time slots a board starts with, made with its first card. Fixed keys,
 * so two GMs starting the same board at once make the same slots, not two
 * sets. The GM renames and adds to them on the Map.
 */
export const DEFAULT_CHUNKS: Chunk[] = [
  { id: 'pre', name: 'Pre-Scenario', position: 1 },
  { id: 'slot-1', name: 'Slot 1', position: 2 },
  { id: 'slot-2', name: 'Slot 2', position: 3 },
  { id: 'slot-3', name: 'Slot 3', position: 4 },
];

/** The slot a card goes in when nothing says otherwise: the first, unless it's a "Pre-…" slot and there's another. */
export function defaultChunkId(chunks: Chunk[]): string | null {
  const sorted = [...chunks].sort((a, b) => a.position - b.position);
  if (!sorted.length) return null;
  return sorted.length > 1 && /pre/i.test(sorted[0].name) ? sorted[1].id : sorted[0].id;
}

/** The condition an IF card's text opens with ("If the guard sees me, …" → "If the guard sees me"), or ''. */
export function guessCondition(text: string): string {
  const m = plainText(text).match(/^\W*((?:if|when|unless|should|in case|once)\b[^,.:;]{2,90})/i);
  return m ? m[1].trim() : '';
}

export interface Placement {
  locationId: string;
  chunkId: string | null;
}

/**
 * Where a card made from a submission goes. Its location: one the quote
 * names, else the owner's last card from earlier in the submission, else one
 * the submission names, else the first. Its slot: that earlier card's, else
 * the default. An IF card waits in Contingencies. Null when the phase has no
 * locations, since every card needs a row.
 */
export function placeNewCard(args: {
  board: BoardDoc;
  chunks: Chunk[];
  locations: CodexEntry[];
  characters: NamedCharacter[];
  ownerId: number;
  quote: string;
  submission: string;
  /** The paragraph the text came from, if it's from one. */
  paragraph: number | null;
  isIF: boolean;
}): Placement | null {
  const { board, chunks, locations, characters, ownerId, quote, submission, paragraph, isIF } = args;
  if (!locations.length) return null;
  const firstLocation = (text: string) => submissionRefs(text, ownerId, characters, locations).codexIds[0];
  const earlier =
    paragraph === null
      ? undefined
      : board.cards
          .filter((c) => c.characterId === ownerId && c.chunkId && c.src.length && Math.min(...c.src) <= paragraph)
          .sort((a, b) => Math.max(...b.src) - Math.max(...a.src) || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0))[0];
  const known = (id: string | undefined) => (id && locations.some((l) => l.id === id) ? id : undefined);
  const locationId = firstLocation(quote) ?? known(earlier?.locationId) ?? firstLocation(submission) ?? locations[0].id;
  const chunkId = isIF ? null : (earlier?.chunkId ?? defaultChunkId(chunks));
  return { locationId, chunkId };
}
