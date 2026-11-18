/**
 * The Write step's view of `action_results`: a character's results this
 * phase as chains of parts, who gets a result, the text every check reads,
 * and which part a moment goes into. Pure; the hooks do the requests.
 */

import type { ActionResult } from '@/types/phases';

export interface ResultChain {
  /** Part 1. Its id is the chain's id: Publish and Delete act on it. */
  head: ActionResult;
  /** Every part in order, head first. An unstaged result is a chain of one. */
  parts: ActionResult[];
}

/**
 * A character's results in a phase, oldest chain first, each with its parts
 * in order. Parts are linked by `parent_result_id`; a part whose parent is
 * missing from the list starts its own chain rather than disappearing.
 */
export function chainsFor(results: ActionResult[], phaseId: number, characterId: number): ResultChain[] {
  const mine = results.filter((r) => r.phase_id === phaseId && r.character_id === characterId);
  const ids = new Set(mine.map((r) => r.id));
  const children = new Map<number, ActionResult>();
  for (const r of mine) if (r.parent_result_id !== undefined && ids.has(r.parent_result_id)) children.set(r.parent_result_id, r);
  const heads = mine.filter((r) => r.parent_result_id === undefined || !ids.has(r.parent_result_id)).sort((a, b) => a.id - b.id);
  return heads.map((head) => {
    const parts = [head];
    for (let next = children.get(head.id); next && parts.length <= mine.length; next = children.get(next.id)) parts.push(next);
    return { head, parts };
  });
}

/** Every character who has a result in the phase, in id order. */
export function characterIdsWithResults(results: ActionResult[], phaseId: number): number[] {
  const ids = new Set<number>();
  for (const r of results) if (r.phase_id === phaseId && r.character_id !== undefined) ids.add(r.character_id);
  return [...ids].sort((a, b) => a - b);
}

/**
 * Who Write lists: everyone who can receive a result (`recipients`, the
 * standalone composer's rule, in cast order), then anyone else who already
 * has a result this phase (someone who has since left), so no result is
 * out of reach.
 */
export function writeList(recipients: number[], withResults: number[]): number[] {
  return [...recipients, ...withResults.filter((id) => !recipients.includes(id))];
}

/**
 * Every part of every result the character has, as the coverage and leak
 * checks read them. `local` holds text typed but not saved yet (result id →
 * text), which wins over the saved copy.
 */
export function draftTexts(chains: ResultChain[], local: ReadonlyMap<number, string> = new Map()): string[] {
  return chains.flatMap((c) => c.parts.map((p) => local.get(p.id) ?? p.content));
}

/** A part the GM can still type into. */
const isEditable = (part: ActionResult) => !part.is_published;

/**
 * Where text added from outside the editor goes (a moment's Insert, Reads
 * as' "Add to draft"): the part the GM last picked, if it's still a draft;
 * else the last part of their newest draft chain; else null, meaning a new
 * first result.
 */
export function targetPart(chains: ResultChain[], selectedId: number | null | undefined): ActionResult | null {
  const all = chains.flatMap((c) => c.parts);
  const picked = all.find((p) => p.id === selectedId);
  if (picked && isEditable(picked)) return picked;
  for (let i = chains.length - 1; i >= 0; i--) {
    const tail = chains[i].parts[chains[i].parts.length - 1];
    if (isEditable(tail)) return tail;
  }
  return null;
}

/**
 * `text` added to the end of `draft`, a blank line between, as a GM would
 * paste a paragraph.
 */
export function appendParagraph(draft: string, text: string): string {
  const body = draft.replace(/\s+$/, '');
  return body ? `${body}\n\n${text}` : text;
}

/** "Ready", "3 results", "Draft", "Published", "Not started": the list's status word. */
export function resultStatus(chains: ResultChain[], ready: boolean): 'ready' | 'published' | 'draft' | 'not started' {
  if (ready) return 'ready';
  if (!chains.length) return 'not started';
  return chains.every((c) => c.head.is_published) ? 'published' : 'draft';
}
