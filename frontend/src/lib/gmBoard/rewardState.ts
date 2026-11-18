/**
 * One character's rewards in a phase, worked out: their sheet before and
 * after, the block, the draft sheet updates, which result carries them, and
 * the checks before publishing. Pure; the Rewards panel, the Rewards table and
 * the sheet sync all read it.
 */

import type { SheetTab } from '@/types/characters';
import type { ActionResult } from '@/types/phases';
import type { ResultChain } from './results';
import { diffCount, draftUpdates, driftedItem, lineKind, linesChangeSheet, sheetDiff, sheetFor, type RewardSheetUpdate, type SheetState, type SheetTabs, type TabDiff } from './rewards';
import { renderBlock, slotsOf, type Block } from './template';
import type { CharacterRewards, GameBoardSettings, RewardItem, RewardLine } from './types';

export const EMPTY_REWARDS: CharacterRewards = { lines: [], texts: {} };

/**
 * Where the sheet changes stand:
 * - `draft`: the carrying result is a draft; the board keeps its drafts in step.
 * - `pending`: it's published, and the changes apply when its last part is revealed.
 * - `applied`: they're on the sheet. Lines are locked from `pending` on.
 * - `no-result`: nothing can carry them yet (no draft result).
 */
type CarrierState = 'draft' | 'pending' | 'applied' | 'no-result';

export interface Carrier {
  state: CarrierState;
  chain?: ResultChain;
  /** The part the drafts go on: the chain's last part. */
  tail?: ActionResult;
}

/**
 * The result that carries a character's sheet changes. The one the GM picked
 * (or the sync last wrote to), while it still exists; else their first draft
 * result. A published pick keeps it: its changes have gone out with it.
 */
export function carrierFor(chains: readonly ResultChain[], carrierHeadId: number | undefined): Carrier {
  const picked = carrierHeadId !== undefined ? chains.find((c) => c.head.id === carrierHeadId) : undefined;
  const chain = picked ?? chains.find((c) => !c.head.is_published);
  if (!chain) return { state: 'no-result' };
  const tail = chain.parts[chain.parts.length - 1];
  if (!chain.head.is_published) return { state: 'draft', chain, tail };
  return { state: tail.released_at || chain.parts.length === 1 ? 'applied' : 'pending', chain, tail };
}

/** Whether a character's lines can still change. */
const linesLocked = (c: Carrier) => c.state === 'pending' || c.state === 'applied';

export type RewardCheck =
  | { kind: 'op-error'; lineId: string; message: string }
  | { kind: 'op-warning'; lineId: string; message: string }
  | { kind: 'drift'; lineId: string; item: RewardItem }
  | { kind: 'block'; message: string }
  | { kind: 'empty-slot'; slot: string }
  | { kind: 'no-result' }
  | { kind: 'empty-result' }
  | { kind: 'block-missing' }
  | { kind: 'block-stale' }
  | { kind: 'block-elsewhere' };

export interface RewardState {
  rewards: CharacterRewards;
  lines: RewardLine[];
  sheet: SheetState;
  diff: TabDiff[];
  changes: number;
  block: Block;
  updates: RewardSheetUpdate[];
  carrier: Carrier;
  locked: boolean;
  /** The changes are on the sheet, and the board has no record of it before them. */
  sheetAlreadyApplied: boolean;
  slots: string[];
  checks: RewardCheck[];
}

export interface RewardInputs {
  settings: Pick<GameBoardSettings, 'rewardTemplate' | 'rewardGroups' | 'scales' | 'rewardItems'>;
  phaseItems: readonly RewardItem[];
  layout: readonly SheetTab[];
  name: string;
  rewards: CharacterRewards | undefined;
  live: SheetTabs;
  chains: readonly ResultChain[];
  /** The carrying part's text as typed, if the editor has it open. */
  tailText?: string;
}

/** Whether a part's text holds the block (spaces at line ends don't count). */
const holds = (content: string, block: string) => {
  const norm = (s: string) => s.replace(/[ \t]+\n/g, '\n').replace(/\r/g, '');
  return norm(content).includes(norm(block));
};

export function rewardStateFor(inputs: RewardInputs): RewardState {
  const rewards = inputs.rewards ?? EMPTY_REWARDS;
  const { lines } = rewards;
  const carrier = carrierFor(inputs.chains, rewards.carrierHeadId);
  const locked = linesLocked(carrier);
  // Once the lines have gone out, the live sheet may already hold them, so
  // they work from the sheet as it was. A result published before that was
  // recorded has no such sheet: its lines are simply not applied again.
  const recorded = locked ? rewards.sheetBefore : undefined;
  const alreadyApplied = carrier.state === 'applied' && !recorded;
  const base = recorded ? { ...inputs.live, ...recorded } : inputs.live;
  const work = (appliedLines: readonly RewardLine[]) => {
    const worked = sheetFor(inputs.layout, base, appliedLines);
    return alreadyApplied ? { ...worked, after: worked.before } : worked;
  };
  const sheet = work(lines);
  const diff = sheetDiff(inputs.layout, sheet);
  // A sheet change (damage, an item used up) is not a reward: it never shows
  // as a line, in {{changes}} or in {{gain}}, which come from the reward
  // lines alone. Tags that state the sheet ({{value}} and the rest) read the
  // real one, so the block never tells a player a wrong total.
  const rewardLines = lines.filter((l) => lineKind(l) === 'reward');
  const blockSheet = rewardLines.length === lines.length ? sheet : work(rewardLines);
  const rendered = renderBlock({
    template: inputs.settings.rewardTemplate,
    groups: inputs.settings.rewardGroups,
    scales: inputs.settings.scales,
    layout: inputs.layout,
    name: inputs.name,
    lines: rewardLines,
    texts: rewards.texts,
    sheet,
    rewardSheet: blockSheet,
    diff: blockSheet === sheet ? diff : sheetDiff(inputs.layout, blockSheet),
  });
  // What went out stays what it was, whatever the template or sheet do later.
  const sent = locked && rewards.block && carrier.chain?.parts.some((p) => holds(p.content, rewards.block as string)) ? rewards.block : undefined;
  const block = sent ? { ...rendered, text: sent } : rendered;
  const slots = slotsOf(inputs.settings.rewardTemplate);
  const items = [...inputs.settings.rewardItems, ...inputs.phaseItems];

  const checks: RewardCheck[] = [];
  if (!locked && lines.length) {
    for (const line of lines) {
      for (const rec of sheet.recs[line.id] ?? []) {
        if (rec.err) checks.push({ kind: 'op-error', lineId: line.id, message: rec.err });
        else if (rec.warn) checks.push({ kind: 'op-warning', lineId: line.id, message: rec.warn });
      }
      const item = driftedItem(line, items);
      if (item) checks.push({ kind: 'drift', lineId: line.id, item });
    }
    for (const message of block.problems) checks.push({ kind: 'block', message });
    for (const slot of slots) if (!rewards.texts[slot]?.trim()) checks.push({ kind: 'empty-slot', slot });
    // The tail's text as typed, when Write passes it; else as saved.
    const partText = (p: ActionResult) => (p.id === carrier.tail?.id && inputs.tailText !== undefined ? inputs.tailText : p.content);
    if (carrier.state === 'no-result') checks.push({ kind: 'no-result' });
    // A draft made when a line was given starts empty: don't let it go out so.
    else if (carrier.state === 'draft' && carrier.chain?.parts.every((p) => !partText(p).trim())) checks.push({ kind: 'empty-result' });
    if (carrier.tail && block.text) {
      const text = inputs.tailText ?? carrier.tail.content;
      if (!holds(text, block.text)) checks.push(rewards.block && holds(text, rewards.block) ? { kind: 'block-stale' } : { kind: 'block-missing' });
      // The block goes on the last part, so a copy left on an earlier one (a
      // part was added after it was put in) would show the player two.
      const copies = [block.text, rewards.block].filter((b): b is string => !!b);
      if (carrier.chain?.parts.some((p) => p.id !== carrier.tail?.id && copies.some((b) => holds(p.content, b)))) checks.push({ kind: 'block-elsewhere' });
    }
  }

  return {
    rewards,
    lines,
    sheet,
    diff,
    changes: diffCount(diff),
    block,
    updates: locked ? [] : draftUpdates(diff),
    carrier,
    locked,
    sheetAlreadyApplied: alreadyApplied && linesChangeSheet(lines),
    slots,
    checks,
  };
}

/**
 * The part's text with the block in it: replacing the copy put there last
 * time when it's still there unchanged, else added at the end.
 */
export function withBlock(content: string, block: string, previous: string | undefined): string {
  // A function, so a `$` in the block stays literal.
  if (previous && content.includes(previous)) return content.replace(previous, () => block);
  const body = content.replace(/\s+$/, '');
  return body ? `${body}\n\n${block}` : block;
}

/** The part's text with a copy of the block taken out, and the gap it left closed. */
export function withoutBlock(content: string, block: string): string {
  const at = block ? content.indexOf(block) : -1;
  if (at < 0) return content;
  const before = content.slice(0, at).replace(/\s+$/, '');
  const after = content.slice(at + block.length).replace(/^\s+/, '');
  return before && after ? `${before}\n\n${after}` : before || after;
}

/** Every entry on the character's sheet once their lines apply. */
export const entryNamesAfter = (state: Pick<RewardState, 'sheet'>): string[] => Object.values(state.sheet.after).flatMap((entries) => entries.map((e) => e.name));

/** A blank line for a new line or a scene's sheet update: the first section, or "other". */
export const defaultGroup = (groups: GameBoardSettings['rewardGroups']) => groups.find((g) => g.key === 'other')?.key ?? groups[0]?.key ?? 'other';
