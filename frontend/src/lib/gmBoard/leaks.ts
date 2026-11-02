/**
 * The leak check: words in a character's result that they shouldn't know.
 * It looks at every part of every result the character has this phase, for:
 * - a secret codex entry's name or alias, unless they're allowed to know it;
 * - a moment's text (or someone's own version of it) that they don't read;
 * - an entry name from someone else's sheet that isn't on theirs.
 *
 * These are warnings for the GM, not rules: a match can be fine in context.
 */

import { inPhase } from './codex';
import { reads } from './moments';
import { termIn, truncate } from './text';
import type { BoardDoc, CodexEntry } from './types';

/** Moment text shorter than this is too generic to count ("He nods."). */
const MIN_MOMENT_CHARS = 13;
/** Sheet entry names shorter than this match too often ("Ax"). */
const MIN_SHEET_NAME_CHARS = 3;

type LeakReason =
  | { kind: 'secret'; entryId: string; entryName: string }
  | { kind: 'hidden'; sceneId: string; momentId: string }
  | { kind: 'sheet'; characterId: number; tabLabel: string };

export interface Leak {
  /** What matched, as it appears in the source (moment text is shortened). */
  term: string;
  reason: LeakReason;
}

export interface LeakInputs {
  characterId: number;
  phaseId: number;
  /** Every part of every result the character has this phase. */
  drafts: string[];
  board: Pick<BoardDoc, 'scenes'>;
  codex: CodexEntry[];
  /** characterId → their sheet's entries (`useGameCharacterSheetItems`). Leave out to skip the sheet check. */
  sheetItems?: Map<number, { name: string; tabLabel: string }[]>;
}

export function leaksFor({ characterId, phaseId, drafts, board, codex, sheetItems }: LeakInputs): Leak[] {
  const text = drafts.join('\n');
  const out: Leak[] = [];
  if (!text.trim()) return out;
  const seen = new Set<string>();
  const add = (term: string, reason: LeakReason) => {
    const k = term.toLowerCase();
    if (seen.has(k)) return;
    seen.add(k);
    out.push({ term, reason });
  };

  if (sheetItems) {
    const mine = new Set((sheetItems.get(characterId) ?? []).map((i) => i.name.toLowerCase()));
    for (const [owner, items] of sheetItems) {
      if (owner === characterId) continue;
      for (const item of items) {
        if (item.name.length >= MIN_SHEET_NAME_CHARS && !mine.has(item.name.toLowerCase()) && termIn(text, item.name)) {
          add(item.name, { kind: 'sheet', characterId: owner, tabLabel: item.tabLabel });
        }
      }
    }
  }

  for (const entry of codex) {
    if (!entry.secret || !inPhase(entry, phaseId) || entry.knownBy.includes(characterId)) continue;
    for (const name of [entry.name, ...entry.aliases]) {
      if (name && termIn(text, name)) add(name, { kind: 'secret', entryId: entry.id, entryName: entry.name });
    }
  }

  // Their own reading of a moment is fine; the shared text of a moment they
  // don't read, and other people's own versions, aren't.
  const lower = text.toLowerCase();
  for (const scene of board.scenes) {
    for (const m of scene.moments) {
      const sees = reads(m, characterId);
      const versions: [string, boolean][] = [[m.text, true]];
      for (const [who, own] of Object.entries(m.ownText)) versions.push([own, Number(who) === characterId]);
      for (const [raw, theirs] of versions) {
        const t = (raw || '').trim();
        if (t.length >= MIN_MOMENT_CHARS && !(sees && theirs) && lower.includes(t.toLowerCase())) {
          add(truncate(t, 50), { kind: 'hidden', sceneId: scene.id, momentId: m.id });
        }
      }
    }
  }
  return out;
}
