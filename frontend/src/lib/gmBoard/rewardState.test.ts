import { describe, expect, it } from 'vitest';
import { resolveSheetLayout } from '@/hooks/useSheetLayout';
import { makeActionResult } from '@/test-utils/factories';
import type { ResultChain } from './results';
import { itemSig, type SheetTabs } from './rewards';
import { carrierFor, defaultGroup, rewardStateFor, withBlock, withoutBlock, type RewardInputs } from './rewardState';
import type { RewardItem, RewardLine } from './types';

const layout = resolveSheetLayout(null).tabs;
const live = (): SheetTabs => ({ skills: [], inventory: [], numbers: [{ id: 'n', name: 'Rating', amount: { value: 1 } }] });

const draft = (id: number, over = {}) => makeActionResult({ id, is_published: false, content: '', ...over });
const chain = (...parts: ReturnType<typeof draft>[]): ResultChain => ({ head: parts[0], parts });

const rating = (id: string, by: number, over: Partial<RewardLine> = {}): RewardLine => ({
  id,
  group: 'result',
  text: `Rating +${by}`,
  ops: [{ act: 'inc', tab: 'numbers', entry: 'Rating', by }],
  choose: false,
  ...over,
});

const inputs = (over: Partial<RewardInputs> = {}): RewardInputs => ({
  settings: { rewardTemplate: '{{lines result}}\nTotal {{value Numbers/Rating}}', rewardGroups: [{ key: 'result', label: 'Result' }], scales: [], rewardItems: [] },
  phaseItems: [],
  layout,
  name: 'Vex',
  rewards: { lines: [rating('a', 2)], texts: {} },
  live: live(),
  chains: [chain(draft(10, { content: 'Story.' }))],
  ...over,
});

describe('carrierFor', () => {
  it('is the first draft chain’s last part', () => {
    const c = carrierFor([chain(makeActionResult({ id: 1, is_published: true })), chain(draft(2), draft(3)), chain(draft(4))], undefined);
    expect(c).toMatchObject({ state: 'draft', tail: { id: 3 } });
  });

  it('keeps the GM’s pick, and a published pick stays the carrier', () => {
    expect(carrierFor([chain(draft(2)), chain(draft(4))], 4).tail?.id).toBe(4);
    const published = chain(makeActionResult({ id: 5, is_published: true }), makeActionResult({ id: 6, is_published: true, part_number: 2, part_count: 2 }));
    expect(carrierFor([published, chain(draft(7))], 5).state).toBe('pending');
    published.parts[1] = { ...published.parts[1], released_at: '2026-11-03T00:00:00Z' };
    expect(carrierFor([published], 5).state).toBe('applied');
    expect(carrierFor([chain(makeActionResult({ id: 8, is_published: true }))], 8).state).toBe('applied');
  });

  it('falls back when the pick is gone, and has no result with no draft', () => {
    expect(carrierFor([chain(draft(2))], 99).tail?.id).toBe(2);
    expect(carrierFor([], undefined).state).toBe('no-result');
  });
});

describe('rewardStateFor: sheet changes', () => {
  const hp = (id: string, by: number, over: Partial<RewardLine> = {}): RewardLine => ({ ...rating(id, by), text: '', kind: 'sheet', ...over });

  it('a sheet change changes the sheet and the drafts, and never shows as a reward in the block', () => {
    const s = rewardStateFor(
      inputs({
        settings: { rewardTemplate: '{{lines result}}\nTotal {{value Numbers/Rating}} ({{gain Numbers/Rating}})\n{{changes Numbers}}', rewardGroups: [{ key: 'result', label: 'Result' }], scales: [], rewardItems: [] },
        rewards: { lines: [rating('a', 2), hp('b', -1, { text: 'Took a hit' })], texts: {} },
      }),
    );
    // The sheet and the drafts get both lines: 1 + 2 - 1.
    expect(s.sheet.after.numbers[0].amount).toEqual({ value: 2 });
    expect(JSON.parse(s.updates[0].field_value)[0].amount).toEqual({ value: 2 });
    // Not a line, and not in {{gain}} or {{changes}}: those are the reward's.
    // {{value}} states the real sheet, so the total is right: 1 + 2 - 1.
    expect(s.block.text).toBe('Rating +2\nTotal 2 (+2)\nRating: 1 → 3');
  });

  it('a line with no kind is a sheet change when it has no text and no list item, as the old "sheet only" line was', () => {
    const legacy = { ...rating('c', -1), text: '' };
    const s = rewardStateFor(inputs({ rewards: { lines: [rating('a', 2), legacy], texts: {} } }));
    expect(s.block.text).toBe('Rating +2\nTotal 2');
    expect(s.sheet.after.numbers[0].amount).toEqual({ value: 2 });
  });
});

describe('rewardStateFor: once the sheet changes are out', () => {
  const ratingAt = (value: number): SheetTabs => ({ skills: [], inventory: [], numbers: [{ id: 'n', name: 'Rating', amount: { value } }] });
  const out = (over = {}) => chain(makeActionResult({ id: 10, is_published: true, content: 'Story.', ...over }));
  const rewards = (over = {}) => ({ lines: [rating('a', 2)], texts: {}, carrierHeadId: 10, ...over });
  const change = (s: ReturnType<typeof rewardStateFor>) => s.diff[0]?.rows[0];

  it('works from the sheet as it was, not from the sheet that already has them', () => {
    const s = rewardStateFor(inputs({ live: ratingAt(3), chains: [out()], rewards: rewards({ sheetBefore: { numbers: ratingAt(1).numbers } }) }));
    expect(change(s)).toMatchObject({ fields: [expect.objectContaining({ before: '1', after: '3' })] });
    expect(s.block.text).toContain('Total 3');
    expect(s.sheetAlreadyApplied).toBe(false);
  });

  it('still says what they did after the sheet changes again', () => {
    const s = rewardStateFor(inputs({ live: ratingAt(10), chains: [out()], rewards: rewards({ sheetBefore: { numbers: ratingAt(1).numbers } }) }));
    expect(change(s)).toMatchObject({ fields: [expect.objectContaining({ before: '1', after: '3' })] });
    expect(s.block.text).toContain('Total 3');
  });

  it('with no record of the sheet before, doesn’t add them again', () => {
    const s = rewardStateFor(inputs({ live: ratingAt(3), chains: [out()], rewards: rewards() }));
    expect(s.changes).toBe(0);
    expect(s.sheetAlreadyApplied).toBe(true);
    expect(s.block.text).toContain('Total 3');
  });

  it('says nothing about the sheet when the lines don’t change it', () => {
    const s = rewardStateFor(inputs({ live: ratingAt(3), chains: [out()], rewards: rewards({ lines: [rating('a', 2, { ops: [] })] }) }));
    expect(s.sheetAlreadyApplied).toBe(false);
  });

  it('while a later part is unrevealed they aren’t on the sheet yet, so they still show from it', () => {
    const waiting = chain(makeActionResult({ id: 10, is_published: true }), makeActionResult({ id: 11, is_published: true, part_number: 2, part_count: 2 }));
    const s = rewardStateFor(inputs({ live: ratingAt(1), chains: [waiting], rewards: rewards() }));
    expect(s.carrier.state).toBe('pending');
    expect(change(s)).toMatchObject({ fields: [expect.objectContaining({ before: '1', after: '3' })] });
    expect(s.sheetAlreadyApplied).toBe(false);
  });

  it('shows the block that went out when the result holds it', () => {
    const held = rewardStateFor(inputs({ live: ratingAt(3), chains: [out({ content: 'Story.\n\nBlock as sent' })], rewards: rewards({ block: 'Block as sent' }) }));
    expect(held.block.text).toBe('Block as sent');
    const gone = rewardStateFor(inputs({ live: ratingAt(3), chains: [out()], rewards: rewards({ block: 'Block as sent' }) }));
    expect(gone.block.text).toContain('Total 3');
  });

  it('a draft ignores the record and uses the live sheet', () => {
    const s = rewardStateFor(inputs({ rewards: { lines: [rating('a', 2)], texts: {}, sheetBefore: { numbers: ratingAt(50).numbers } } }));
    expect(change(s)).toMatchObject({ fields: [expect.objectContaining({ before: '1', after: '3' })] });
  });
});

describe('rewardStateFor', () => {
  it('works out the block, the diff and the drafts', () => {
    const s = rewardStateFor(inputs());
    expect(s.block.text).toBe('Rating +2\nTotal 3');
    expect(s.changes).toBe(1);
    expect(s.updates).toHaveLength(1);
    expect(s.locked).toBe(false);
  });

  it('once the carrier is published: locked, no drafts to sync, no checks', () => {
    const s = rewardStateFor(inputs({ chains: [chain(makeActionResult({ id: 10, is_published: true }))], rewards: { lines: [rating('a', 2)], texts: {}, carrierHeadId: 10 } }));
    expect(s.locked).toBe(true);
    expect(s.updates).toEqual([]);
    expect(s.checks).toEqual([]);
  });

  it('checks: a broken op, a warning, drift, block problems, an empty slot, the block not in the result', () => {
    const item: RewardItem = { id: 'it', scope: 'game', name: 'Win', group: 'result', text: 'Won', ops: [], choose: false, position: 1 };
    const s = rewardStateFor(
      inputs({
        settings: { rewardTemplate: '{{lines result}} {{text Comment}} {{nope}}', rewardGroups: [{ key: 'result', label: 'Result' }], scales: [], rewardItems: [{ ...item, text: 'Won big' }] },
        rewards: {
          lines: [
            { ...rating('a', 1), ops: [{ act: 'inc', tab: 'numbers', entry: 'Gold', by: 1 }] },
            rating('b', -5),
            { id: 'c', itemId: 'it', itemSig: itemSig(item), group: 'result', text: 'Won', ops: [], choose: false },
          ],
          texts: {},
        },
      }),
    );
    expect(s.checks.map((c) => c.kind)).toEqual(['op-error', 'op-warning', 'drift', 'block', 'empty-slot', 'block-missing']);
  });

  it('no result to carry the changes', () => {
    expect(rewardStateFor(inputs({ chains: [] })).checks.map((c) => c.kind)).toEqual(['no-result']);
  });

  it('the block in the result: current, out of date, or read from the text being typed', () => {
    const block = 'Rating +2\nTotal 3';
    expect(rewardStateFor(inputs({ chains: [chain(draft(10, { content: `Story.\n\n${block}` }))] })).checks).toEqual([]);
    const stale = rewardStateFor(inputs({ chains: [chain(draft(10, { content: 'Story.\n\nOld block' }))], rewards: { lines: [rating('a', 2)], texts: {}, block: 'Old block' } }));
    expect(stale.checks.map((c) => c.kind)).toEqual(['block-stale']);
    expect(rewardStateFor(inputs({ tailText: `Typed. ${block}` })).checks).toEqual([]);
  });

  it('a copy of the block left on an earlier part', () => {
    const block = 'Rating +2\nTotal 3';
    const parts = (first: string) => chain(draft(10, { content: first }), draft(11, { content: `Later.\n\n${block}`, parent_result_id: 10 }));
    expect(rewardStateFor(inputs({ chains: [parts(`Story.\n\n${block}`)] })).checks.map((c) => c.kind)).toEqual(['block-elsewhere']);
    expect(rewardStateFor(inputs({ chains: [parts('Story.\n\nOld block')], rewards: { lines: [rating('a', 2)], texts: {}, block: 'Old block' } })).checks.map((c) => c.kind)).toEqual(['block-elsewhere']);
    expect(rewardStateFor(inputs({ chains: [parts('Story.')] })).checks).toEqual([]);
  });

  it('no lines: nothing to check', () => {
    expect(rewardStateFor(inputs({ rewards: undefined, chains: [] })).checks).toEqual([]);
  });
});

describe('withoutBlock', () => {
  it('takes the block out and closes the gap', () => {
    expect(withoutBlock('Story.\n\nBlock\n\nMore.', 'Block')).toBe('Story.\n\nMore.');
    expect(withoutBlock('Story.\n\nBlock', 'Block')).toBe('Story.');
    expect(withoutBlock('Block', 'Block')).toBe('');
    expect(withoutBlock('Story.', 'Block')).toBe('Story.');
  });
});

describe('withBlock', () => {
  it('keeps dollar signs in the block as written', () => {
    for (const block of ['Pay $$5', 'Worth $& more', 'A $` and a $\'']) expect(withBlock('Story.\n\nOld', block, 'Old')).toBe(`Story.\n\n${block}`);
  });

  it('replaces the copy put there last time, else adds it at the end', () => {
    expect(withBlock('Story.\n\nOld', 'New', 'Old')).toBe('Story.\n\nNew');
    expect(withBlock('Story.  \n', 'New', 'Gone')).toBe('Story.\n\nNew');
    expect(withBlock('', 'New', undefined)).toBe('New');
  });
});

describe('defaultGroup', () => {
  it('prefers “other”, else the first section', () => {
    expect(defaultGroup([{ key: 'a', label: 'A' }, { key: 'other', label: 'Other' }])).toBe('other');
    expect(defaultGroup([{ key: 'a', label: 'A' }])).toBe('a');
    expect(defaultGroup([])).toBe('other');
  });
});
