import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { EntryManager } from './EntryManager';
import { TabNavigation } from '@/components/layout/TabNavigation';
import { EditorLockNotice } from '@/components/characters/EditorLockNotice';
import { useDirtyChildren } from '@/hooks/useDirtyChildren';
import { resolveSheetLayout } from '@/hooks/useSheetLayout';
import type { SheetTab } from '@/types/characters';
import type { RawSheetEntry } from '@/lib/sheetEntries';
import { logger } from '@/services/LoggingService';
import type { LootRolling } from '@/hooks/useLootRoll';

vi.mock('@/services/LoggingService', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), debug: vi.fn(), info: vi.fn() },
}));

// The loot modes need a game with a loot table.
vi.mock('@/contexts/GameContext', () => ({
  useOptionalGameContext: () => ({ gameId: 7 }),
}));
vi.mock('@/lib/api', () => ({
  apiClient: {
    games: {
      getLootTables: vi.fn().mockResolvedValue({ data: [{ id: 11, game_id: 7, name: 'Common Loot', target_tab: 'inventory' }] }),
      getLootTableContents: vi.fn().mockResolvedValue({ data: [] }),
    },
  },
}));

const SKILLS: SheetTab = resolveSheetLayout(undefined).tabs[0];

const renderManager = (props: Partial<React.ComponentProps<typeof EntryManager>> = {}) => {
  const onEntriesChange = vi.fn();
  render(<EntryManager tab={SKILLS} entries={[]} canEdit={true} onEntriesChange={onEntriesChange} {...props} />);
  return { onEntriesChange, user: userEvent.setup({ delay: null }) };
};

const cardFor = (name: string) =>
  within(screen.getAllByTestId('sheet-entry').find(card => within(card).queryByRole('heading', { name }))!);

describe('EntryManager', () => {
  describe('the tab', () => {
    it('is named after the game\'s label, with test ids keyed to the stable tab key', () => {
      // A Blades game calls this tab "Playbook"; nothing here may say "Skills".
      renderManager({ tab: { ...SKILLS, label: 'Playbook' } });

      expect(screen.getByTestId('skills-section')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Playbook' })).toBeInTheDocument();
      expect(screen.getByText(/no playbook yet/i)).toBeInTheDocument();
      // Visible text stays generic; the label reaches assistive tech instead.
      expect(screen.getByTestId('add-skills')).toHaveTextContent('Add New');
      expect(screen.getByRole('button', { name: 'Add to Playbook' })).toBeInTheDocument();
    });

    it('hides the add control from viewers who cannot edit', () => {
      renderManager({ canEdit: false });
      expect(screen.queryByTestId('add-skills')).not.toBeInTheDocument();
    });

    it('lays entries out by the tab\'s schema', () => {
      renderManager({
        tab: { key: 't_abc123', label: 'Contacts', isBuiltIn: false, fields: [{ key: 'f_loc000', label: 'Location', type: 'text' }] },
        entries: [{ id: 'c1', name: 'Vex', f_loc000: 'Docks', rank: 'ignored: not in this schema' }],
      });
      expect(screen.getByTestId('t_abc123-section')).toBeInTheDocument();
      expect(screen.getByText('Docks')).toBeInTheDocument();
      expect(screen.queryByText(/ignored/)).not.toBeInTheDocument();
    });

    it('reads legacy rows through normalizeEntry', () => {
      renderManager({ entries: [{ id: 's1', name: 'Stealth', level: 3 }] });
      expect(screen.getByText('Rank:')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
    });
  });

  describe('defensive ids', () => {
    // Rows are removed by id, so a row without one takes its neighbours with it.
    it('generates missing ids and logs a warning', () => {
      vi.mocked(logger.warn).mockClear();
      renderManager({ entries: [{ name: 'Stealth' }, { name: 'Lockpicking' }] });
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Skills missing id field'), expect.any(Object));
      expect(logger.warn).toHaveBeenCalledTimes(2);
    });

    it('removes only the targeted entry after generating ids', async () => {
      const { onEntriesChange, user } = renderManager({
        entries: [{ name: 'Stealth' }, { name: 'Lockpicking' }, { name: 'Persuasion' }],
      });
      await user.click(cardFor('Lockpicking').getByRole('button', { name: 'Remove entry' }));

      const names = onEntriesChange.mock.calls[0][0].map((e: RawSheetEntry) => e.name);
      expect(names).toEqual(['Stealth', 'Persuasion']);
    });

    it('does not warn when every row has an id', () => {
      vi.mocked(logger.warn).mockClear();
      renderManager({ entries: [{ id: 's1', name: 'Stealth' }] });
      expect(logger.warn).not.toHaveBeenCalled();
    });
  });

  describe('writes', () => {
    it('adds an entry through the modal', async () => {
      const { onEntriesChange, user } = renderManager({ entries: [{ id: 's1', name: 'Stealth' }] });
      await user.click(screen.getByTestId('add-skills'));
      await user.type(screen.getByRole('textbox', { name: 'Name *' }), 'Lockpicking');
      await user.type(screen.getByRole('textbox', { name: 'Rank' }), 'Novice');
      await user.click(screen.getByRole('button', { name: 'Add' }));

      const [written] = onEntriesChange.mock.calls[0];
      expect(written).toHaveLength(2);
      expect(written[1]).toEqual({ id: expect.any(String), name: 'Lockpicking', rank: 'Novice' });
      expect(screen.queryByRole('textbox', { name: 'Name *' })).not.toBeInTheDocument();
    });

    it('rewrites only the edited entry, leaving the others exactly as stored', async () => {
      // A GM who adds and then removes an entry must produce the published list
      // byte for byte; the draft modal drops no-op drafts on that comparison.
      const untouched = { id: 's1', name: 'Stealth', level: 3 };
      const { onEntriesChange, user } = renderManager({ entries: [untouched, { id: 's2', name: 'Lore', rank: '1' }] });

      await user.click(cardFor('Lore').getByRole('button', { name: 'Edit entry' }));
      await user.clear(screen.getByRole('textbox', { name: 'Rank' }));
      await user.type(screen.getByRole('textbox', { name: 'Rank' }), '2');
      await user.click(screen.getByRole('button', { name: 'Save' }));

      const [written] = onEntriesChange.mock.calls[0];
      expect(written[0]).toBe(untouched);
      expect(written[1]).toEqual({ id: 's2', name: 'Lore', rank: '2' });
    });

    it('writes an edited legacy row in the new shape', async () => {
      const { onEntriesChange, user } = renderManager({ entries: [{ id: 's1', name: 'Stealth', level: 3 }] });

      await user.click(screen.getByRole('button', { name: 'Edit entry' }));
      await user.click(screen.getByRole('button', { name: 'Save' }));

      expect(onEntriesChange.mock.calls[0][0][0]).toEqual({ id: 's1', name: 'Stealth', rank: '3' });
    });

    it('keeps values of fields the schema no longer has', async () => {
      // Removing a field hides its data; it must survive the next save.
      const { onEntriesChange, user } = renderManager({
        entries: [{ id: 's1', name: 'Stealth', rank: '3', f_gone00: 'kept', equipped: true }],
      });

      await user.click(screen.getByRole('button', { name: 'Edit entry' }));
      await user.type(screen.getByRole('textbox', { name: 'Rank' }), '+');
      await user.click(screen.getByRole('button', { name: 'Save' }));

      expect(onEntriesChange.mock.calls[0][0][0]).toEqual({
        id: 's1', name: 'Stealth', rank: '3+', f_gone00: 'kept', equipped: true,
      });
    });
  });
});

describe('EntryManager on the Numbers tab', () => {
  const NUMBERS: SheetTab = resolveSheetLayout(undefined).tabs.find(tab => tab.key === 'numbers')!;

  it('reads legacy rows: type as the name, flat amount/max/display as a track', () => {
    renderManager({
      tab: NUMBERS,
      entries: [
        { id: 'n1', type: 'Gold', amount: 50 },
        { id: 'n2', name: 'Stress', amount: 4, max: 9, display: 'track' },
      ],
    });
    expect(screen.getByTestId('numbers-section')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Gold' })).toBeInTheDocument();
    expect(cardFor('Gold').getByText('50')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Stress, Amount: 4 of 9' })).toBeInTheDocument();
  });

  it('adds an entry with its track as one value', async () => {
    const { onEntriesChange, user } = renderManager({ tab: NUMBERS });
    await user.click(screen.getByTestId('add-numbers'));
    await user.type(screen.getByRole('textbox', { name: 'Name *' }), 'Stress');
    await user.type(screen.getByRole('spinbutton', { name: 'Current' }), '2.5');
    await user.type(screen.getByRole('spinbutton', { name: 'Maximum' }), '9');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Display as' }), 'boxes');
    await user.click(screen.getByRole('button', { name: 'Add' }));

    expect(onEntriesChange.mock.calls[0][0][0]).toEqual({
      id: expect.any(String), name: 'Stress', amount: { value: 2.5, max: 9, display: 'boxes' },
    });
  });

  it('writes an edited legacy row in the new shape, dropping every legacy key', async () => {
    const { onEntriesChange, user } = renderManager({
      tab: NUMBERS,
      entries: [{ id: 'n1', type: 'Stress', amount: 4, max: 9, display: 'boxes', description: 'Mind' }],
    });

    await user.click(screen.getByRole('button', { name: 'Edit entry' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(onEntriesChange.mock.calls[0][0][0]).toEqual({
      id: 'n1', name: 'Stress', amount: { value: 4, max: 9, display: 'boxes' }, description: 'Mind',
    });
  });
});

describe('EntryManager on the Inventory tab', () => {
  const INVENTORY: SheetTab = resolveSheetLayout(undefined).tabs.find(tab => tab.key === 'inventory')!;

  it('shows an item\'s fields, with no weight/value totals', () => {
    renderManager({
      tab: INVENTORY,
      entries: [{ id: 'i1', name: 'Rope', quantity: 3, weight: 2, value: 1, category: 'Tool', equipped: false }],
    });
    expect(screen.getByTestId('inventory-section')).toBeInTheDocument();
    const card = cardFor('Rope');
    expect(card.getByText('Quantity:')).toBeInTheDocument();
    expect(card.getByText('Tool')).toBeInTheDocument();
    // Dropped: no game used the totals (decided 2026-09-28).
    expect(screen.queryByText(/total weight/i)).not.toBeInTheDocument();
  });

  it('reads a quantity stored as a string by a CSV-sourced roll', () => {
    renderManager({ tab: INVENTORY, entries: [{ id: 'i1', name: 'Arrows', quantity: '20' }] });
    expect(cardFor('Arrows').getByText('20')).toBeInTheDocument();
  });

  describe('loot rolls', () => {
    const rollFromModal = async (user: ReturnType<typeof userEvent.setup>) => {
      await user.click(screen.getByTestId('add-inventory'));
      await user.selectOptions(await screen.findByRole('combobox', { name: 'Mode' }), 'loot_table_random');
      await user.selectOptions(screen.getByRole('combobox', { name: 'Loot Table' }), '11');
      await user.click(screen.getByRole('button', { name: 'Add' }));
    };

    it('closes the modal after a successful roll, writing nothing itself', async () => {
      const roll = vi.fn().mockResolvedValue(true);
      const { onEntriesChange, user } = renderWithLoot(roll);
      await rollFromModal(user);

      expect(roll).toHaveBeenCalledWith(11, 'inventory');
      await waitFor(() => expect(screen.queryByRole('combobox', { name: 'Mode' })).not.toBeInTheDocument());
      // The server wrote the entry; writing the list back would race it.
      expect(onEntriesChange).not.toHaveBeenCalled();
    });

    it('keeps the modal open when a roll fails, so the GM can retry', async () => {
      const roll = vi.fn().mockResolvedValue(false);
      const { user } = renderWithLoot(roll);
      await rollFromModal(user);

      await waitFor(() => expect(roll).toHaveBeenCalled());
      expect(screen.getByRole('combobox', { name: 'Loot Table' })).toHaveValue('11');
    });

    const renderWithLoot = (roll: LootRolling['roll']) => {
      const onEntriesChange = vi.fn();
      render(
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <EntryManager
            tab={INVENTORY}
            entries={[]}
            canEdit={true}
            onEntriesChange={onEntriesChange}
            loot={{ modes: ['manual', 'loot_table', 'loot_table_random'], roll }}
          />
        </QueryClientProvider>,
      );
      return { onEntriesChange, user: userEvent.setup({ delay: null }) };
    };
  });
});

/**
 * Stands in for CharacterSheet's tab strip: the real sheet needs a QueryClient, a
 * router and an API, none of which this regression is about. It reproduces the
 * structure that matters — a manager reporting dirty state up to an ancestor
 * that owns the tabs and holds them while an editor is open.
 *
 * TabNavigation renders a <select> in jsdom (no width), carrying the same
 * `disabled` state the button strip does.
 */
function SheetHarness() {
  const { isAnyDirty, report } = useDirtyChildren();
  const [activeTab, setActiveTab] = useState('skills');

  return (
    <div>
      <TabNavigation
        tabs={[{ id: 'skills', label: 'Skills' }, { id: 'inventory', label: 'Inventory' }]}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        disabled={isAnyDirty}
      />
      {isAnyDirty && <EditorLockNotice />}
      {activeTab === 'skills' ? (
        <EntryManager
          tab={SKILLS}
          entries={[{ id: 's1', name: 'Stealth', rank: '3' }]}
          canEdit={true}
          onEntriesChange={vi.fn()}
          onDirtyChange={(d) => report('skills', d)}
        />
      ) : (
        <div>Inventory tab</div>
      )}
    </div>
  );
}

/**
 * Regression: editing an entry and then switching tabs unmounted the open
 * editor, wiping the edit while the footer went on warning about unsaved
 * changes that no longer existed. Navigation is held until the editor is saved
 * or cancelled.
 */
describe('character sheet tab lock', () => {
  const startEditing = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getByRole('button', { name: 'Edit entry' }));
    await user.type(await screen.findByDisplayValue('Stealth'), ' II');
  };

  it('allows switching tabs when no editor is open', async () => {
    const user = userEvent.setup({ delay: null });
    render(<SheetHarness />);
    await user.selectOptions(screen.getByRole('combobox'), 'inventory');
    expect(screen.getByText('Inventory tab')).toBeInTheDocument();
  });

  it('locks the tabs while an editor holds edits', async () => {
    const user = userEvent.setup({ delay: null });
    render(<SheetHarness />);
    await startEditing(user);

    expect(screen.getAllByRole('combobox')[0]).toBeDisabled();
    expect(screen.getByTestId('editor-lock-notice')).toBeInTheDocument();
  });

  it('keeps the edit intact because the tab click cannot unmount the editor', async () => {
    const user = userEvent.setup({ delay: null });
    render(<SheetHarness />);
    await startEditing(user);

    await user.selectOptions(screen.getAllByRole('combobox')[0], 'inventory').catch(() => {});

    expect(screen.getByDisplayValue('Stealth II')).toBeInTheDocument();
    expect(screen.queryByText('Inventory tab')).not.toBeInTheDocument();
  });

  it('unlocks the tabs once the editor is cancelled', async () => {
    const user = userEvent.setup({ delay: null });
    render(<SheetHarness />);
    await startEditing(user);

    await user.click(screen.getByRole('button', { name: /^cancel$/i }));

    expect(screen.getByRole('combobox')).toBeEnabled();
    expect(screen.queryByTestId('editor-lock-notice')).not.toBeInTheDocument();
  });
});
