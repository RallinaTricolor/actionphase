import { describe, expect, it } from 'vitest';
import { resolveSheetLayout } from '@/hooks/useSheetLayout';
import type { SheetTab } from '@/types/characters';
import { sheetDiff, sheetFor, type SheetTabs } from './rewards';
import { renderBlock, scaleLabel, slotsOf, type BlockContext } from './template';
import type { RewardLine } from './types';

// A hand-built game shaped like Starlight's Day 2 rewards: a Challenges tab
// holding the rating, the minor-objective counter and progress tracks.
const challenges: SheetTab = {
  key: 't_chal01',
  label: 'Challenges',
  isBuiltIn: false,
  fields: [{ key: 'progress', label: 'Progress', type: 'track' }],
};
const layout: SheetTab[] = [...resolveSheetLayout(null).tabs, challenges];
const groups = [
  { key: 'result', label: 'Scenario result' },
  { key: 'bonus', label: 'Bonus objectives' },
  { key: 'minor', label: 'Minor objectives' },
  { key: 'other', label: 'Other' },
];
const scales = [
  {
    name: 'Challenges/Rating',
    steps: [
      { min: 0, label: 'Flickering' },
      { min: 5.5, label: 'Glowing' },
      { min: 9.5, label: 'Shining' },
    ],
  },
];
const STARLIGHT = `# Rewards

{{lines result}}

{{if bonus}}## Bonus Objectives Completed:

{{lines bonus}}{{end}}

{{if minor}}### Minor Objectives Completed:

{{lines minor}}

{{value Challenges/Minor Objectives}}/3 Minor Objectives completed until reward{{end}}

{{lines other}}

**Current Total Rating:** {{value Challenges/Rating}} ({{label Challenges/Rating}})

**Aurelia's Comment:** "{{text Aurelia's Comment}}"

---

Versatile: {{value Challenges/Versatile}}/{{max Challenges/Versatile}}`;

const live = (): SheetTabs => ({
  skills: [],
  inventory: [],
  numbers: [],
  t_chal01: [
    { id: 'r', name: 'Rating', progress: { value: 4.5 } },
    { id: 'm', name: 'Minor Objectives', progress: { value: 2 } },
    { id: 'v', name: 'Versatile', progress: { value: 3, max: 7 } },
  ],
});

const inc = (entry: string, by: number) => ({ act: 'inc' as const, tab: 't_chal01', entry, by });
const line = (id: string, group: string, text: string, ops: RewardLine['ops'] = [], extra: Partial<RewardLine> = {}): RewardLine => ({ id, group, text, ops, choose: false, ...extra });

function block(over: Partial<BlockContext> & { lines?: RewardLine[] } = {}) {
  const lines = over.lines ?? [];
  const sheet = sheetFor(layout, over.sheet?.before ?? live(), lines);
  return renderBlock({ template: STARLIGHT, groups, scales, layout, name: 'Vex Morrow', texts: {}, sheet, diff: sheetDiff(layout, sheet), ...over, lines });
}

describe('renderBlock: the Day 2 shape', () => {
  it('fills the track total, the tier name and the minor objectives counter', () => {
    const { text, problems } = block({
      lines: [
        line('a', 'result', '**Scenario result:** Complete - 2 rating', [inc('Rating', 2)]),
        line('b', 'minor', '*Showman*', [inc('Minor Objectives', 1)]),
        line('c', 'minor', '3/3 Minor Objectives completed!\n\n**Reward:** 0.5 rating', [inc('Minor Objectives', -3), inc('Rating', 0.5)]),
        line('d', 'other', '', [inc('Versatile', 1)]),
      ],
      texts: { "Aurelia's Comment": 'Dazzling, darling.' },
    });
    expect(problems).toEqual([]);
    expect(text).toBe(`# Rewards

**Scenario result:** Complete - 2 rating

### Minor Objectives Completed:

*Showman*

3/3 Minor Objectives completed!

**Reward:** 0.5 rating

0/3 Minor Objectives completed until reward

**Current Total Rating:** 7 (Glowing)

**Aurelia's Comment:** "Dazzling, darling."

---

Versatile: 4/7`);
  });

  it('drops a section nobody earned', () => {
    const { text } = block({ lines: [line('a', 'result', 'Partial', [inc('Rating', 1)])] });
    expect(text).not.toContain('Bonus Objectives');
    expect(text).not.toContain('Minor Objectives Completed');
    expect(text).toContain('**Current Total Rating:** 5.5 (Glowing)');
  });

  it('a line with no text changes the sheet but adds nothing to the block, nor opens its section', () => {
    const { text } = block({ lines: [line('a', 'bonus', '', [inc('Rating', 1)])] });
    expect(text).not.toContain('Bonus Objectives');
  });
});

describe('renderBlock: tags', () => {
  const base = { template: '', lines: [] as RewardLine[] };

  it('before, gain, name, changes and {{entry}} in line text', () => {
    const lines = [
      line('a', 'result', 'Got {{entry}}: {{before}} -> {{after}}', [inc('Rating', 1.5)]),
      line('b', 'other', '', [{ act: 'add', tab: 'inventory', entry: 'Key', fields: {} }]),
    ];
    const { text, problems } = block({
      ...base,
      lines,
      template: '{{name}} {{before Challenges/Rating}} {{gain Challenges/Rating}} {{gain Challenges/Versatile}}\n{{lines result}}\n{{changes Inventory}}\n{{changes t_chal01}}',
    });
    // The Key line has no text, so its missing {{lines other}} isn't a problem.
    expect(problems).toEqual([]);
    expect(text).toBe('Vex Morrow 4.5 +1.5 +0\nGot Rating: 4.5 -> 6\n**Key** (new)\nRating: 4.5 → 6');
  });

  it('a field by label, and a set field', () => {
    const lines = [line('a', 'result', '', [{ act: 'set', tab: 'skills', entry: 'x', field: 'rank', value: '2' }])];
    const { text } = block({ ...base, lines, template: '{{value Challenges/Versatile/Progress}}' });
    expect(text).toBe('3');
  });

  it('{{if}} on a slot, on a sheet value, and nested', () => {
    const template = '{{if Note}}N:{{text Note}}{{end}}|{{if Challenges/Rating}}R{{if result}}+res{{end}}{{end}}|{{if Challenges/Gone}}G{{end}}';
    expect(block({ ...base, template }).text).toBe('|R|');
    expect(block({ ...base, template, texts: { Note: 'hi' }, lines: [line('a', 'result', 'x')] }).text).toBe('N:hi|R+res|');
  });

  it('a value that is 0 is false', () => {
    const before = live();
    before.t_chal01[0].progress = { value: 0 };
    expect(block({ ...base, template: '{{if Challenges/Rating}}yes{{end}}', sheet: { before, after: before, recs: {} } }).text).toBe('');
  });
});

describe('renderBlock: problems', () => {
  const problems = (template: string, lines: RewardLine[] = []) => block({ template, lines }).problems;

  it('an unknown {{if}}, with did-you-mean for a near miss or the wrong capitals', () => {
    expect(problems('{{if bonsu}}x{{end}}')).toEqual(['{{if bonsu}}: nothing is called “bonsu”. Did you mean {{if bonus}}?']);
    expect(problems('{{if Bonus}}x{{end}}')).toEqual(['{{if Bonus}}: nothing is called “Bonus”. Did you mean {{if bonus}}?']);
    expect(problems('{{if zebra}}x{{end}}')).toEqual([
      '{{if zebra}}: nothing is called “zebra”. Use a section (result, bonus, minor, other), a {{text}} slot, or a sheet value like Numbers/Rating.',
    ]);
  });

  it('an empty, unclosed or stray if', () => {
    expect(problems('{{if}}x{{end}}')).toEqual(['{{if}} needs a name, like {{if bonus}}.', '{{end}} has no {{if …}} before it.']);
    expect(problems('{{if bonus}}x')).toEqual(['{{if bonus}} has no {{end}} after it.']);
    expect(problems('x{{end}}')).toEqual(['{{end}} has no {{if …}} before it.']);
  });

  it('unknown tags, refs that find nothing, a max-less max, a scale-less label', () => {
    expect(problems('{{lnes result}}')).toEqual(['{{lnes result}} isn’t a tag the block knows.']);
    expect(problems('{{value Nope/Rating}}')).toEqual(['{{value Nope/Rating}}: there’s no tab “Nope”.']);
    expect(problems('{{value Challenges/Gone}}')).toEqual(['{{value Challenges/Gone}}: Vex Morrow has no Challenges entry “Gone”.']);
    expect(problems('{{value Challenges}}')).toEqual(['{{value Challenges}}: name an entry, like Challenges/Name.']);
    expect(problems('{{max Challenges/Rating}}')).toEqual(['{{max Challenges/Rating}}: it has no max.']);
    expect(problems('{{label Challenges/Versatile}}')).toEqual(['{{label Challenges/Versatile}}: there’s no scale for it in Game setup.']);
    expect(block({ template: '{{value Nope/X}}' }).text).toBe('?');
  });

  it('lines in a section the template never lists', () => {
    expect(problems('{{lines result}}', [line('a', 'bonus', 'B')])).toEqual(['Lines in “Bonus objectives” don’t appear: the template has no {{lines bonus}}.']);
  });

  it('a problem repeated is listed once', () => {
    expect(problems('{{value Nope/A}} {{value Nope/A}}')).toHaveLength(1);
  });
});

describe('slotsOf and scaleLabel', () => {
  it('lists slots once, in order', () => {
    expect(slotsOf("{{text Aurelia's Comment}} {{ text Note }} {{text Aurelia's Comment}}")).toEqual(["Aurelia's Comment", 'Note']);
  });

  it('names a number from the last step at or below it', () => {
    expect(scaleLabel(scales, 'challenges/rating', 9.5)).toBe('Shining');
    expect(scaleLabel(scales, 'Challenges/Rating', 5.4)).toBe('Flickering');
    expect(scaleLabel(scales, 'Challenges/Rating', -1)).toBe('');
    expect(scaleLabel(scales, 'Other', 1)).toBeUndefined();
  });
});

describe('parseGroups and parseScales', () => {
  it('reads one section per line, the key without spaces, the key as label when none', async () => {
    const { parseGroups } = await import('./template');
    expect(parseGroups('result: Scenario result\n\nminor objectives\n : nothing')).toEqual([
      { key: 'result', label: 'Scenario result' },
      { key: 'minor_objectives', label: 'minor_objectives' },
    ]);
  });

  it('reads one scale per line, skipping steps that aren’t “number name”', async () => {
    const { parseScales } = await import('./template');
    expect(parseScales('Challenges/Rating: 0 Flickering, 5.5 Glowing, oops\nno colon')).toEqual([
      { name: 'Challenges/Rating', steps: [{ min: 0, label: 'Flickering' }, { min: 5.5, label: 'Glowing' }] },
    ]);
  });
});
