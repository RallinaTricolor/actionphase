import { describe, it, expect } from 'vitest';
import { makeActionResult } from '@/test-utils/factories';
import { canAppendPart, canCancelPart, canEditDelay, chainTail, hasChainControls, isChainTail, takesSheetUpdates } from './resultParts';

const draft = makeActionResult({ id: 1 });
const head = makeActionResult({ id: 1, part_number: 1, part_count: 3 });
const middle = makeActionResult({ id: 2, part_number: 2, part_count: 3, parent_result_id: 1 });
const tail = makeActionResult({ id: 3, part_number: 3, part_count: 3, parent_result_id: 2 });
const published = (r: ReturnType<typeof makeActionResult>, released = false) =>
  ({ ...r, is_published: true, released_at: released ? '2025-01-01T00:00:00Z' : undefined });

describe('result part controls', () => {
  it('an unstaged draft is its own head and tail', () => {
    expect([hasChainControls(draft), isChainTail(draft), canAppendPart(draft), takesSheetUpdates(draft)]).toEqual([true, true, true, true]);
    expect([canCancelPart(draft), canEditDelay(draft)]).toEqual([false, false]);
  });

  it('a draft chain: Publish and Delete on the head, append and sheet updates on the tail, Cancel and delay on followers', () => {
    expect([hasChainControls(head), canAppendPart(head), canCancelPart(head), canEditDelay(head)]).toEqual([true, false, false, false]);
    expect([hasChainControls(middle), canAppendPart(middle), canCancelPart(middle), canEditDelay(middle)]).toEqual([false, false, true, true]);
    expect([canAppendPart(tail), takesSheetUpdates(tail), canCancelPart(tail)]).toEqual([true, true, true]);
  });

  it('published: no append, Publish, Delete or sheet updates; an unrevealed part can still be retimed or cancelled', () => {
    expect([canAppendPart(published(tail)), hasChainControls(published(head)), takesSheetUpdates(published(tail))]).toEqual([false, false, false]);
    expect([canEditDelay(published(tail)), canCancelPart(published(tail))]).toEqual([true, true]);
    expect([canEditDelay(published(tail, true)), canCancelPart(published(tail, true))]).toEqual([false, false]);
  });
});

describe('chainTail', () => {
  const other = makeActionResult({ id: 9 });

  it('follows the parts to the last one, whatever order the list is in', () => {
    expect(chainTail(head, [tail, other, head, middle]).id).toBe(3);
    expect(chainTail(middle, [head, middle, tail]).id).toBe(3);
  });

  it('is the result itself when nothing follows it', () => {
    expect(chainTail(draft, [draft, other]).id).toBe(1);
    expect(chainTail(tail, [head, middle, tail]).id).toBe(3);
  });

  it('stops where the list runs out of parts', () => {
    expect(chainTail(head, [head, middle]).id).toBe(2);
  });
});
