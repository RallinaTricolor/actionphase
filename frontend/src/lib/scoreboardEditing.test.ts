import { describe, expect, it } from 'vitest';
import { resolveSheetLayout } from '@/hooks/useSheetLayout';
import type { ScoreboardColumn } from '@/types/scoreboard';
import {
  duplicateScoreboardColumnIds,
  findScoreboardSourceField,
  newScoreboardColumn,
  removeScoreboardColumn,
  scoreboardSourceTabs,
  scoreboardBandLabelError,
  scoreboardBandsProblem,
  scoreboardColumnsComplete,
  scoreboardLabelText,
  scoreboardTopCountError,
  toScoreboardConfig,
  withScoreboardSource,
} from './scoreboardEditing';

const column = (overrides: Partial<ScoreboardColumn> = {}): ScoreboardColumn => ({
  id: 'c_score1',
  label: 'Score',
  tab_key: 'numbers',
  entry: 'Score',
  field_key: 'amount',
  ...overrides,
});

describe('scoreboardSourceTabs', () => {
  it('offers the default tabs that have numbers, with only their numeric fields', () => {
    const tabs = scoreboardSourceTabs(resolveSheetLayout(undefined));

    expect(tabs.map((tab) => tab.key)).toEqual(['inventory', 'numbers']);
    expect(tabs[0].fields.map((field) => field.key)).toEqual(['quantity', 'value', 'weight']);
    expect(tabs[1].fields).toEqual([{ key: 'amount', label: 'Amount', type: 'track' }]);
  });

  it('includes a custom tab with a number field and leaves out one without', () => {
    const tabs = scoreboardSourceTabs(resolveSheetLayout({
      tabs: [
        { key: 't_abc123', label: 'Resources', fields: [{ key: 'f_gold00', label: 'Gold', type: 'number' }] },
        { key: 't_def456', label: 'Notes', fields: [{ key: 'f_text00', label: 'Text', type: 'text' }] },
      ],
    }));

    expect(tabs.map((tab) => tab.label)).toEqual(['Resources']);
  });
});

describe('findScoreboardSourceField', () => {
  const tabs = scoreboardSourceTabs(resolveSheetLayout(undefined));

  it('finds the field a column reads', () => {
    expect(findScoreboardSourceField(tabs, column())?.type).toBe('track');
  });

  it.each([
    ['tab', { tab_key: 't_gone00' }],
    ['field', { field_key: 'description' }],
  ])('finds nothing when the %s is gone', (_name, source) => {
    expect(findScoreboardSourceField(tabs, column(source))).toBeUndefined();
  });
});

describe('newScoreboardColumn', () => {
  it('takes its heading from the entry and gets an ID the backend accepts', () => {
    const created = newScoreboardColumn({ tab_key: 'numbers', entry: '  Score ', field_key: 'amount' }, new Set());

    expect(created).toMatchObject({ label: 'Score', entry: 'Score' });
    expect(created.id).toMatch(/^c_[a-z0-9]{6}$/);
  });

  it('shortens a long entry name to fit a heading', () => {
    const entry = 'A very long entry name that goes on';
    const created = newScoreboardColumn({ tab_key: 'numbers', entry, field_key: 'amount' }, new Set());

    expect(created.label).toBe('A very long entry name t');
    expect(created.entry).toBe(entry);
  });
});

describe('withScoreboardSource', () => {
  const inventory = { tab_key: 'inventory', entry: 'Gold', field_key: 'quantity' };

  it('drops what only a track can do when moved to a number', () => {
    const moved = withScoreboardSource(column({ display: 'value_max' }), inventory, 'number');
    expect(moved.display).toBeUndefined();

    const banded = withScoreboardSource(
      column({ display: 'bands', band_basis: 'percent', bands: [{ label: 'Low', max: 50 }] }), inventory, 'number');
    expect(banded).toMatchObject({ display: 'bands', bands: [{ label: 'Low', max: 50 }] });
    expect(banded.band_basis).toBeUndefined();
  });

  it('keeps them when moved to another track', () => {
    const moved = withScoreboardSource(column({ display: 'value_max' }), { ...inventory, tab_key: 'numbers', field_key: 'amount' }, 'track');
    expect(moved.display).toBe('value_max');
  });

  it('renames a heading that was just the entry name, but not one the GM wrote', () => {
    expect(withScoreboardSource(column(), inventory, 'number').label).toBe('Gold');
    expect(withScoreboardSource(column({ label: 'Points' }), inventory, 'number').label).toBe('Points');
  });

  it('renames a default heading that was cut short from a long entry name', () => {
    const entry = 'Reputation with the Thieves Guild';
    const created = newScoreboardColumn({ tab_key: 'numbers', entry, field_key: 'amount' }, new Set());

    expect(withScoreboardSource(created, inventory, 'number').label).toBe('Gold');
  });
});

describe('removeScoreboardColumn', () => {
  it('takes the sort key with it, leaving the other', () => {
    const next = removeScoreboardColumn({
      columns: [column(), column({ id: 'c_other1' })],
      sort: [{ key: 'c_score1', direction: 'desc' }, { key: 'c_other1', direction: 'asc' }],
    }, 'c_score1');

    expect(next.columns?.map(({ id }) => id)).toEqual(['c_other1']);
    expect(next.sort).toEqual([{ key: 'c_other1', direction: 'asc' }]);
  });
});

describe('duplicateScoreboardColumnIds', () => {
  it('matches sources the way the board does, ignoring case and spaces', () => {
    const ids = duplicateScoreboardColumnIds([
      column({ id: 'c_first1' }),
      column({ id: 'c_second', entry: ' score ' }),
      column({ id: 'c_other1', entry: 'Renown' }),
    ]);

    expect([...ids]).toEqual(['c_first1', 'c_second']);
  });
});

describe('toScoreboardConfig', () => {
  it('leaves out every default', () => {
    expect(toScoreboardConfig({ visibility: 'staff', columns: [], sort: [{ key: 'name', direction: 'asc' }] })).toEqual({});
  });

  it('keeps what was chosen, trimmed', () => {
    expect(toScoreboardConfig({
      visibility: 'public',
      columns: [column({ label: ' Score ', hidden: true, display: 'value_max' })],
      sort: [{ key: 'c_score1', direction: 'desc' }],
    })).toEqual({
      visibility: 'public',
      columns: [{ ...column(), hidden: true, display: 'value_max' }],
      sort: [{ key: 'c_score1', direction: 'desc' }],
    });
  });

  it('keeps a top count, and leaves it out when there is none', () => {
    expect(toScoreboardConfig({ top_count: 3 })).toEqual({ top_count: 3 });
    expect(toScoreboardConfig({})).not.toHaveProperty('top_count');
  });

  it('sends ranges only for a column showing them', () => {
    const bands = [{ label: 'Low', max: 5 }];
    const [shown] = toScoreboardConfig({
      columns: [column({ display: 'bands', bands, band_basis: 'percent', fallback_label: ' Unknown ' })],
    }).columns!;
    expect(shown).toMatchObject({ display: 'bands', bands, band_basis: 'percent', fallback_label: 'Unknown' });

    const [switchedAway] = toScoreboardConfig({
      columns: [column({ bands, band_basis: 'percent', fallback_label: 'Unknown' })],
    }).columns!;
    expect(switchedAway).toEqual(column());
  });

  it('drops a strict flag whose bound was cleared', () => {
    const [{ bands }] = toScoreboardConfig({
      columns: [column({ display: 'bands', bands: [{ label: 'Low', min_strict: true, max: 5, max_strict: true }] })],
    }).columns!;

    expect(bands).toEqual([{ label: 'Low', max: 5, max_strict: true }]);
  });
});

describe('scoreboardTopCountError', () => {
  it('accepts nothing, or a whole number from 1 to 50', () => {
    for (const count of [undefined, 1, 3, 50]) expect(scoreboardTopCountError(count)).toBeUndefined();
  });

  it('refuses anything else', () => {
    for (const count of [0, -1, 51, 2.5]) expect(scoreboardTopCountError(count)).toBe('Enter a whole number from 1 to 50');
  });
});

// The same cases as TestScoreboardLabelText in the backend: the two must agree.
describe('scoreboardLabelText', () => {
  it.each([
    ['Healthy', 'Healthy'],
    ['[color:red]Bloody[/color]', 'Bloody'],
    ['**Down** _soon_', 'Down soon'],
    ['~~Gone~~ `x`', 'Gone x'],
    ['[color:red]A[/color] [color:blue]B[/color]', 'A B'],
    // What the renderer leaves as literal text counts as text: an unclosed tag,
    // a stray closing tag, and a colour it doesn't know.
    ['[color:red]Bloody[/color', '[color:red]Bloody[/color'],
    ['Bloody[/color]', 'Bloody[/color]'],
    ['[color:mauve]Odd[/color]', '[color:mauve]Odd[/color]'],
    ['[colour:red]Typo', '[colour:red]Typo'],
    ['[color:red]A\nB[/color]', 'A\nB'],
    ['[color:crimson]A[/color] [color:red]B[/color]', '[color:crimson]A[/color] B'],
  ])('%s reads as %s', (label, text) => {
    expect(scoreboardLabelText(label)).toBe(text);
  });
});

describe('scoreboardBandLabelError', () => {
  const full = 'x'.repeat(24);

  it('counts only the text, so formatting is free', () => {
    for (const label of [undefined, '', full, `[color:orange]**${full}**[/color]`, `~~${full}~~`]) {
      expect(scoreboardBandLabelError(label)).toBeUndefined();
    }
  });

  it('refuses text over the limit, however it is formatted', () => {
    expect(scoreboardBandLabelError(`[color:red]${full}x[/color]`))
      .toBe('Keep it to 24 characters, not counting formatting');
  });

  it('counts a colour the renderer shows as text', () => {
    expect(scoreboardBandLabelError('[color:red]Bloodied[/color]')).toBeUndefined();
    expect(scoreboardBandLabelError('[color:crimson]Bloodied[/color]'))
      .toBe('Keep it to 24 characters, not counting formatting');
  });

  it('refuses formatting with no text in it', () => {
    expect(scoreboardBandLabelError('[color:red]**[/color]')).toBe('Add some text, not just formatting');
    expect(scoreboardBandLabelError('** **')).toBe('Add some text, not just formatting');
  });
});

describe('scoreboardBandsProblem', () => {
  const banded = (overrides: Partial<ScoreboardColumn>): ScoreboardColumn => ({
    id: 'c_hp0001', label: 'HP', tab_key: 'numbers', entry: 'HP', field_key: 'amount',
    display: 'bands', bands: [{ label: 'Low', max: 5 }], ...overrides,
  });

  it('accepts ranges the server would store', () => {
    expect(scoreboardBandsProblem(banded({}))).toBeUndefined();
    expect(scoreboardBandsProblem(banded({ bands: [{ label: 'Even', min: 5, max: 5 }], fallback_label: 'Other' }))).toBeUndefined();
  });

  // Each of these is a 422 from core.ValidateScoreboardConfig.
  it.each([
    ['no ranges', { bands: [] }, 'Add at least one range'],
    ['a range just added', { bands: [{ label: '' }] }, 'Range 1 needs a label'],
    ['a label of only formatting', { bands: [{ label: '****', max: 5 }] }, 'Range 1 needs a label'],
    ['a label too long', { bands: [{ label: 'Low', max: 5 }, { label: 'x'.repeat(25), min: 6 }] },
      'Range 2: Keep it to 24 characters, not counting formatting'],
    ['a range with no bound', { bands: [{ label: 'Low' }] }, 'Range 1 needs a lower or upper bound'],
    ['bounds the wrong way round', { bands: [{ label: 'Low', min: 6, max: 5 }] }, 'Range 1 can never match'],
    ['a strict bound on a single value', { bands: [{ label: 'Low', min: 5, max: 5, max_strict: true }] }, 'Range 1 can never match'],
    ['a bad label for no match', { fallback_label: '**' }, 'Label when no range matches: Add some text, not just formatting'],
  ] as const)('refuses %s', (_name, overrides, problem) => {
    expect(scoreboardBandsProblem(banded(overrides as Partial<ScoreboardColumn>))).toBe(problem);
  });

  it('ignores ranges a column no longer shows', () => {
    expect(scoreboardBandsProblem(banded({ display: 'value', bands: [{ label: '' }], fallback_label: '**' }))).toBeUndefined();
  });
});

describe('scoreboardColumnsComplete', () => {
  it('needs a heading on every column, and ranges that would save', () => {
    expect(scoreboardColumnsComplete([column()])).toBe(true);
    expect(scoreboardColumnsComplete([column(), column({ id: 'c_blank1', label: '  ' })])).toBe(false);
    expect(scoreboardColumnsComplete([column({ display: 'bands', bands: [{ label: '' }] })])).toBe(false);
  });
});
