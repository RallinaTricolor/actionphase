import { describe, it, expect } from 'vitest';
import { makeActionResult } from '@/test-utils/factories';
import { appendParagraph, chainsFor, characterIdsWithResults, draftTexts, resultStatus, targetPart, writeList } from './results';

const r = makeActionResult;
// Character 1: a published single result, then a three-part draft chain.
// Character 2: one draft. A result from another phase is ignored.
const results = [
  r({ id: 10, character_id: 1, content: 'Published.', is_published: true }),
  r({ id: 21, character_id: 1, content: 'Part one.', part_number: 1, part_count: 3 }),
  r({ id: 23, character_id: 1, content: 'Part three.', part_number: 3, part_count: 3, parent_result_id: 22 }),
  r({ id: 22, character_id: 1, content: 'Part two.', part_number: 2, part_count: 3, parent_result_id: 21 }),
  r({ id: 30, character_id: 2, content: 'Mara’s draft.' }),
  r({ id: 40, character_id: 1, phase_id: 2, content: 'Another phase.' }),
];

describe('chainsFor', () => {
  it('groups parts into chains by parent, oldest chain first, parts in order', () => {
    const chains = chainsFor(results, 1, 1);
    expect(chains.map((c) => c.head.id)).toEqual([10, 21]);
    expect(chains[1].parts.map((p) => p.id)).toEqual([21, 22, 23]);
  });

  it('starts a chain at a part whose parent isn’t in the list, rather than losing it', () => {
    const chains = chainsFor([r({ id: 5, character_id: 1, parent_result_id: 99 })], 1, 1);
    expect(chains.map((c) => c.parts.map((p) => p.id))).toEqual([[5]]);
  });

  it('only this phase and character', () => {
    expect(chainsFor(results, 2, 1).map((c) => c.head.id)).toEqual([40]);
    expect(chainsFor(results, 1, 3)).toEqual([]);
  });
});

describe('who Write lists', () => {
  it('everyone who can receive a result, then anyone else with a result this phase', () => {
    const withResults = characterIdsWithResults([...results, r({ id: 50, character_id: 9 })], 1);
    expect(withResults).toEqual([1, 2, 9]);
    expect(writeList([2, 1, 3], withResults)).toEqual([2, 1, 3, 9]);
  });
});

describe('draftTexts', () => {
  it('every part of every result, with unsaved text in place of the saved copy', () => {
    const chains = chainsFor(results, 1, 1);
    expect(draftTexts(chains, new Map([[22, 'Typed, not saved.']]))).toEqual(['Published.', 'Part one.', 'Typed, not saved.', 'Part three.']);
  });
});

describe('targetPart', () => {
  const chains = chainsFor(results, 1, 1);
  it('the part the GM picked, while it’s still a draft', () => {
    expect(targetPart(chains, 22)?.id).toBe(22);
  });
  it('else the last part of the newest draft chain', () => {
    expect(targetPart(chains, null)?.id).toBe(23);
    expect(targetPart(chains, 10)?.id).toBe(23); // published: can't type into it
  });
  it('null when nothing is a draft, meaning a new first result', () => {
    expect(targetPart(chainsFor(results, 1, 1).slice(0, 1), null)).toBeNull();
    expect(targetPart([], null)).toBeNull();
  });
});

describe('appendParagraph', () => {
  it('adds a paragraph after a blank line, trimming trailing space', () => {
    expect(appendParagraph('One.\n\n  ', 'Two.')).toBe('One.\n\nTwo.');
    expect(appendParagraph('', 'Two.')).toBe('Two.');
  });
});

describe('resultStatus', () => {
  it('ready wins; else not started, draft, or published', () => {
    const chains = chainsFor(results, 1, 1);
    expect(resultStatus(chains, true)).toBe('ready');
    expect(resultStatus([], false)).toBe('not started');
    expect(resultStatus(chains, false)).toBe('draft');
    expect(resultStatus(chains.slice(0, 1), false)).toBe('published');
  });
});
