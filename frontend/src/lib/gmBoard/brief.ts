/**
 * Write's brief: one character's phase in time order, for the GM to write
 * their result from. Per time slot: their cards, the scenes they read
 * moments in (from elsewhere too), scenes they're in but read nothing from,
 * the moments in their scenes they don't get (so the GM knows what not to
 * say), and the state changes that happen to them. Data only.
 */

import { isWaiting } from './cards';
import { missReason, perceivedMoments } from './moments';
import { characterStates, chunkIndex, stateAt } from './states';
import { stanceOf } from './stances';
import type { BoardDoc, Card, CharState, Chunk, Moment, Scene, Stance } from './types';

export interface BriefScene {
  scene: Scene;
  /** They're in the cast (not reading from elsewhere). */
  here: boolean;
  /** What they read, in scene order. */
  moments: Moment[];
  /** In their scenes only: moments with text that they don't get. */
  hidden: { moment: Moment; note: boolean }[];
}

interface BriefSlot {
  chunk: Chunk;
  cards: Card[];
  scenes: BriefScene[];
  effects: { state: CharState; untilChunkId?: string }[];
}

export interface Brief {
  slots: BriefSlot[];
  /** IF cards that never triggered. */
  waiting: Card[];
  /** Moot cards, left out of `slots` unless `showMoot`. */
  mootCount: number;
  /** Their state once the phase is over. */
  endState: CharState;
  /** How they see others (`out`) and how others see them (`in`, GM only). Neutral is left out. */
  stances: { out: { id: number; stance: Stance }[]; in: { id: number; stance: Stance }[] };
}

/** Cards in submission order: by the first paragraph they came from, GM cards last. */
const bySource = (a: Card, b: Card) => Math.min(...a.src, 1e9) - Math.min(...b.src, 1e9);

export function briefFor(board: BoardDoc, characterId: number, others: number[], showMoot = false): Brief {
  const index = chunkIndex(board);
  const chunks = [...board.chunks].sort((a, b) => a.position - b.position);
  const mine = board.cards.filter((c) => c.characterId === characterId);
  const perceived = perceivedMoments(board, characterId);

  const slots: BriefSlot[] = [];
  for (const chunk of chunks) {
    const cards = mine.filter((c) => c.chunkId === chunk.id && (showMoot || c.outcome !== 'moot')).sort(bySource);
    const scenes: BriefScene[] = [];
    for (const scene of board.scenes.filter((s) => s.chunkId === chunk.id)) {
      const here = scene.participants.includes(characterId);
      const moments = perceived.find((g) => g.scene.id === scene.id)?.moments ?? [];
      if (!here && !moments.length) continue;
      const hidden = here
        ? scene.moments
            .filter((m) => m.text.trim() && missReason(m, scene, characterId) !== null && missReason(m, scene, characterId) !== 'no-text')
            .map((moment) => ({ moment, note: moment.readers.length === 0 }))
        : [];
      scenes.push({ scene, here, moments, hidden });
    }
    const effects = board.scenes
      .filter((s) => s.chunkId === chunk.id)
      .flatMap((s) => s.effects.filter((e) => e.characterId === characterId).map(({ state, untilChunkId }) => ({ state, untilChunkId })));
    if (cards.length || scenes.length || effects.length) slots.push({ chunk, cards, scenes, effects });
  }

  const states = characterStates(board);
  const out: Brief['stances']['out'] = [];
  const inbound: Brief['stances']['in'] = [];
  for (const id of others) {
    if (id === characterId) continue;
    const o = stanceOf(board.stances, characterId, id);
    if (o && o.value !== 'neutral') out.push({ id, stance: o });
    const i = stanceOf(board.stances, id, characterId);
    if (i && i.value !== 'neutral') inbound.push({ id, stance: i });
  }

  return {
    slots,
    waiting: mine.filter(isWaiting),
    mootCount: mine.filter((c) => c.outcome === 'moot').length,
    endState: index.size ? stateAt(states, characterId, index.size - 1) : 'active',
    stances: { out, in: inbound },
  };
}
