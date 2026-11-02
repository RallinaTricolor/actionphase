import { describe, it, expect } from 'vitest';
import { makeBoard, makeCard, makeCodexEntry } from '@/test-utils/factories';
import {
  cardAt,
  cardedSpans,
  defaultChunkId,
  DEFAULT_CHUNKS,
  findMatches,
  flatIndexAt,
  flattenText,
  guessCondition,
  paragraphCardCounts,
  placeNewCard,
  submissionBlocks,
  submissionLinks,
  submissionRefs,
} from './read';
import { phaseLocations } from './codex';

const SUBMISSION = [
  '## Plan',
  '',
  'I sneak into the Old Mill at dusk.',
  'Then I wait by the wheel.',
  '',
  '- Bribe the miller',
  '- If the dogs bark, run for the river',
  '',
  '---',
  '',
  'Ask Mara about the ledger.',
].join('\n');

describe('submissionBlocks', () => {
  const blocks = submissionBlocks(SUBMISSION);

  it('numbers paragraphs and list lines, not headings or rules', () => {
    expect(blocks.map((b) => [b.kind, b.index])).toEqual([
      ['h', null],
      ['p', 0],
      ['li', 1],
      ['li', 2],
      ['hr', null],
      ['p', 3],
    ]);
  });

  it('keeps each block’s markdown and its bare words', () => {
    expect(blocks[1].source).toBe('I sneak into the Old Mill at dusk.\nThen I wait by the wheel.');
    expect(blocks[2]).toMatchObject({ source: '- Bribe the miller', text: 'Bribe the miller' });
    expect(blocks[0].text).toBe('Plan');
  });

  it('keeps a fenced block whole, blank lines and all', () => {
    const fenced = submissionBlocks('Before.\n\n```\nline one\n\nline two\n```\n\nAfter.');
    expect(fenced.map((b) => b.index)).toEqual([0, 1, 2]);
    expect(fenced[1].text).toBe('line one\n\nline two');
  });

  it('gives an empty submission no blocks', () => {
    expect(submissionBlocks('')).toEqual([]);
    expect(submissionBlocks('\n\n  \n')).toEqual([]);
  });
});

describe('paragraphCardCounts', () => {
  const blocks = submissionBlocks(SUBMISSION);

  it('counts a card for the paragraphs it came from, and for text that overlaps', () => {
    const cards = [
      makeCard({ id: 'a', characterId: 1, quote: 'I sneak into the Old Mill at dusk.', src: [0] }),
      makeCard({ id: 'b', characterId: 1, quote: 'Ask Mara about the ledger.', src: [] }),
      makeCard({ id: 'c', characterId: 1, quote: 'Whole list', src: [1, 2] }),
      makeCard({ id: 'other', characterId: 2, quote: 'Ask Mara about the ledger.', src: [3] }),
    ];
    expect(paragraphCardCounts(blocks, cards, 1)).toEqual({ 0: 1, 1: 1, 2: 1, 3: 1 });
  });

  it('doesn’t count GM cards with no quote', () => {
    expect(paragraphCardCounts(blocks, [makeCard({ id: 'g', characterId: 1, summary: 'x', src: [0] })], 1)[0]).toBe(0);
  });
});

describe('findMatches and submissionRefs', () => {
  const characters = [
    { id: 1, names: ['Harrison Vale', 'Harrison'] },
    { id: 2, names: ['Mara'] },
  ];
  const codex = [
    makeCodexEntry({ id: 'mill', type: 'Location', name: 'the Old Mill', aliases: ['mill'] }),
    makeCodexEntry({ id: 'ledger', type: 'Item', name: 'ledger' }),
    makeCodexEntry({ id: 'x', name: 'M' }),
  ];

  it('finds names case-sensitively and codex terms in any case, longest first', () => {
    const text = 'Harrison Vale and @Mara go to The Old Mill; mara stays.';
    const found = findMatches(text, characters, codex).map((m) => [text.slice(m.start, m.end), m.tag]);
    expect(found).toEqual([
      ['Harrison Vale', { kind: 'name', characterId: 1 }],
      ['@Mara', { kind: 'name', characterId: 2 }],
      ['The Old Mill', { kind: 'codex', entryId: 'mill' }],
    ]);
  });

  it('ignores names inside sheet references and terms shorter than two letters', () => {
    expect(findMatches('[[Mara’s ledger|item:9]] M', characters, codex)).toEqual([]);
  });

  it('lists who and what a submission names, without its owner', () => {
    expect(submissionRefs('Harrison asks Mara for the ledger at the mill. Harrison waits.', 1, characters, codex)).toEqual({
      mentions: [2],
      codexIds: ['ledger', 'mill'],
    });
  });
});

describe('submissionLinks', () => {
  const characters = [
    { id: 1, names: ['Harrison'] },
    { id: 2, names: ['Mara'] },
    { id: 3, names: ['Ilse'] },
    { id: 4, names: ['Quill'] },
  ];
  const codex = [
    makeCodexEntry({ id: 'mill', type: 'Location', name: 'mill' }),
    makeCodexEntry({ id: 'dock', type: 'Location', name: 'dock' }),
    makeCodexEntry({ id: 'ledger', type: 'Item', name: 'ledger' }),
  ];
  const subs = [
    { characterId: 1, text: 'I go to the mill with the ledger.' },
    { characterId: 2, text: 'I follow Harrison.' },
    { characterId: 3, text: 'I burn the mill down.' },
    { characterId: 4, text: 'I read the ledger at the dock.' },
  ];

  it('finds who names the owner, and who will be in the same place unnamed', () => {
    expect(submissionLinks(subs, 1, characters, codex)).toEqual({
      mentions: [],
      codexIds: ['mill', 'ledger'],
      mentionedBy: [2],
      samePlace: [{ characterId: 3, locationIds: ['mill'] }],
    });
  });

  it('leaves someone the owner names out of “same place”', () => {
    const named = [...subs.slice(1), { characterId: 1, text: 'I meet Ilse at the mill.' }];
    expect(submissionLinks(named, 1, characters, codex)).toMatchObject({ mentions: [3], samePlace: [] });
  });
});

describe('carded text', () => {
  it('flattens text nodes, collapsing whitespace, and maps back to each node', () => {
    const { flat, map } = flattenText(['  I sneak\n into', 'the mill.']);
    expect(flat).toBe('I sneak into the mill. ');
    expect(map[0]).toEqual([0, 2]);
    expect(map[flat.indexOf('the')]).toEqual([1, 0]);
  });

  it('maps a click in a text node back to the flattened text', () => {
    const { flat, map } = flattenText(['  I sneak\n into', 'the mill.', '   ']);
    expect(flat[flatIndexAt(map, 0, 5)]).toBe('n');
    expect(flat[flatIndexAt(map, 0, 0)]).toBe('I');
    expect(flat[flatIndexAt(map, 1, 4)]).toBe('m');
    expect(flatIndexAt(map, 1, 99)).toBe(flat.length - 1);
    expect(flatIndexAt(map, 2, 0)).toBe(-1);
  });

  it('finds each quote card’s text in any case, falling back to its first 60 characters', () => {
    const flat = 'I sneak into the Old Mill at dusk. Then I wait by the wheel for a very long time indeed, until morning.';
    const long = 'Then I wait by the wheel for a very long time indeed, until morning comes and goes.';
    const spans = cardedSpans(
      flat,
      [
        makeCard({ id: 'a', characterId: 1, quote: 'i sneak into the **old mill**' }),
        makeCard({ id: 'b', characterId: 1, quote: long }),
        makeCard({ id: 'gone', characterId: 1, quote: 'Not in the text at all.' }),
        makeCard({ id: 'theirs', characterId: 2, quote: 'I sneak' }),
      ],
      1,
    );
    expect(spans.map((s) => [s.cardId, flat.slice(s.start, s.end)])).toEqual([
      ['a', 'I sneak into the Old Mill'],
      ['b', long.slice(0, 60)],
    ]);
  });

  it('opens the shortest card under the cursor', () => {
    const spans = [
      { start: 0, end: 50, cardId: 'whole' },
      { start: 10, end: 20, cardId: 'part' },
    ];
    expect(cardAt(spans, 15)).toBe('part');
    expect(cardAt(spans, 30)).toBe('whole');
    expect(cardAt(spans, 50)).toBeNull();
  });
});

describe('new cards', () => {
  const codex = [
    makeCodexEntry({ id: 'hall', type: 'Location', name: 'hall' }),
    makeCodexEntry({ id: 'mill', type: 'Location', name: 'mill' }),
    makeCodexEntry({ id: 'dock', type: 'Location', name: 'dock', phases: [9] }),
    makeCodexEntry({ id: 'ledger', type: 'Item', name: 'ledger' }),
  ];
  const locations = phaseLocations(codex, 5);
  const characters = [{ id: 1, names: ['Harrison'] }];
  const base = { characters, ownerId: 1, submission: 'I start at the mill.', isIF: false };

  it('uses this phase’s locations only', () => {
    expect(locations.map((l) => l.id)).toEqual(['hall', 'mill']);
  });

  it('starts in the slot after a “Pre-” slot', () => {
    expect(defaultChunkId(DEFAULT_CHUNKS)).toBe('slot-1');
    expect(defaultChunkId([{ id: 'a', name: 'Dawn', position: 1 }, { id: 'b', name: 'Noon', position: 2 }])).toBe('a');
    expect(defaultChunkId([])).toBeNull();
  });

  it('places a card where its quote says, else after an earlier card, else where the submission says', () => {
    const board = makeBoard({ cards: [makeCard({ id: 'c1', characterId: 1, locationId: 'hall', chunkId: 'k3', src: [0] })] });
    const args = { ...base, board, chunks: board.chunks, locations };
    expect(placeNewCard({ ...args, quote: 'Then to the mill.', paragraph: 2 })).toEqual({ locationId: 'mill', chunkId: 'k3' });
    expect(placeNewCard({ ...args, quote: 'Then I wait.', paragraph: 2 })).toEqual({ locationId: 'hall', chunkId: 'k3' });
    expect(placeNewCard({ ...args, quote: 'Then I wait.', paragraph: null })).toEqual({ locationId: 'mill', chunkId: 'k2' });
  });

  it('takes the latest earlier card, ignoring later paragraphs and waiting cards', () => {
    const board = makeBoard({
      cards: [
        makeCard({ id: 'c1', characterId: 1, locationId: 'hall', chunkId: 'k1', src: [0] }),
        makeCard({ id: 'c2', characterId: 1, locationId: 'mill', chunkId: 'k2', src: [1] }),
        makeCard({ id: 'c3', characterId: 1, locationId: 'hall', chunkId: 'k3', src: [5] }),
        makeCard({ id: 'c4', characterId: 1, locationId: 'hall', chunkId: null, src: [2] }),
      ],
    });
    const out = placeNewCard({ ...base, board, chunks: board.chunks, locations, quote: 'x', paragraph: 3, submission: '' });
    expect(out).toEqual({ locationId: 'mill', chunkId: 'k2' });
  });

  it('puts an IF card in Contingencies, and refuses when there’s no location', () => {
    const board = makeBoard();
    const args = { ...base, board, chunks: board.chunks, quote: 'x', paragraph: 0 };
    expect(placeNewCard({ ...args, locations, isIF: true })?.chunkId).toBeNull();
    expect(placeNewCard({ ...args, locations: [] })).toBeNull();
  });

  it('reads the condition an IF card opens with', () => {
    expect(guessCondition('If the dogs bark, run for the river')).toBe('If the dogs bark');
    expect(guessCondition('- **When** night falls: hide')).toBe('When night falls');
    expect(guessCondition('Run for the river')).toBe('');
  });
});
