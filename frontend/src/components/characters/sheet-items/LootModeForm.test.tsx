import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LootModeForm } from './LootModeForm';
import { resolveSheetLayout } from '@/hooks/useSheetLayout';
import type { LootMode } from '@/hooks/useLootRoll';

// Loot modes require a game context; null stands in for "outside a GameProvider".
const mockGameContext = vi.hoisted(() => ({ current: null as { gameId: number } | null }));
vi.mock('@/contexts/GameContext', () => ({
  useOptionalGameContext: () => mockGameContext.current,
}));

const mockGetLootTables = vi.hoisted(() => vi.fn());
const mockGetLootTableContents = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api', () => ({
  apiClient: {
    games: {
      getLootTables: mockGetLootTables,
      getLootTableContents: mockGetLootTableContents,
    },
  },
}));

const mockLoggerError = vi.hoisted(() => vi.fn());
vi.mock('@/services/LoggingService', () => ({
  logger: { error: mockLoggerError, warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

const INVENTORY = resolveSheetLayout(undefined).tabs.find((tab) => tab.key === 'inventory')!;
const ALL_MODES: LootMode[] = ['manual', 'loot_table', 'loot_table_random'];

const renderForm = (
  { lootModes = ALL_MODES, client }: { lootModes?: LootMode[]; client?: QueryClient } = {},
) => {
  const onAdd = vi.fn();
  const onAddRandom = vi.fn();
  const queryClient = client ?? new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const ui = (modes: LootMode[]) => (
    <QueryClientProvider client={queryClient}>
      <LootModeForm fields={INVENTORY.fields} lootModes={modes} onAdd={onAdd} onAddRandom={onAddRandom} onCancel={vi.fn()} />
    </QueryClientProvider>
  );
  const { rerender } = render(ui(lootModes));
  return { onAdd, onAddRandom, rerender: (modes: LootMode[]) => rerender(ui(modes)), user: userEvent.setup({ delay: null }) };
};

const modeSelect = () => screen.getByRole('combobox', { name: 'Mode' });
const tableSelect = () => screen.getByRole('combobox', { name: 'Loot Table' });
const contentSelect = () => screen.getByRole('combobox', { name: 'Loot Table Content' });
const addButton = () => screen.getByRole('button', { name: 'Add' });

describe('LootModeForm', () => {
  beforeEach(() => {
    mockGameContext.current = { gameId: 7 };
    mockGetLootTables.mockReset();
    mockGetLootTableContents.mockReset();
    mockLoggerError.mockReset();
    mockGetLootTables.mockResolvedValue({ data: [{ id: 11, game_id: 7, name: 'Common Loot' }] });
  });

  describe('mode availability', () => {
    it('offers the mode picker inside a game that has loot tables', async () => {
      renderForm();
      expect(await screen.findByRole('combobox', { name: 'Mode' })).toBeInTheDocument();
    });

    it('offers no mode picker outside a game', () => {
      mockGameContext.current = null;
      renderForm();
      // Loot tables are game-scoped, so the opt-in alone is not enough.
      expect(screen.queryByRole('combobox', { name: 'Mode' })).not.toBeInTheDocument();
      expect(mockGetLootTables).not.toHaveBeenCalled();
    });

    it('offers no mode picker inside a game with no loot tables', async () => {
      mockGetLootTables.mockResolvedValue({ data: [] });
      renderForm();
      await waitFor(() => expect(mockGetLootTables).toHaveBeenCalled());
      await screen.findByRole('textbox', { name: 'Name *' });
      expect(screen.queryByRole('combobox', { name: 'Mode' })).not.toBeInTheDocument();
    });

    it('offers only the modes the caller allows', async () => {
      renderForm({ lootModes: ['manual', 'loot_table'] });
      await screen.findByRole('combobox', { name: 'Mode' });
      expect(screen.queryByRole('option', { name: 'Loot Table (Random)' })).not.toBeInTheDocument();
    });

    it('adds a manual entry through the schema form', async () => {
      const { onAdd, user } = renderForm();
      await screen.findByRole('combobox', { name: 'Mode' });
      await user.type(screen.getByRole('textbox', { name: 'Name *' }), 'Rope');
      await user.click(addButton());
      expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ name: 'Rope' }));
    });

    it('keeps a half-typed manual entry across a look at the loot tables', async () => {
      const { user } = renderForm();
      await screen.findByRole('combobox', { name: 'Mode' });
      await user.type(screen.getByRole('textbox', { name: 'Name *' }), 'Rope');
      await user.selectOptions(modeSelect(), 'loot_table');
      await user.selectOptions(modeSelect(), 'manual');
      expect(screen.getByRole('textbox', { name: 'Name *' })).toHaveValue('Rope');
    });
  });

  describe('loot table mode (pick a specific entry)', () => {
    const pick = async (user: ReturnType<typeof userEvent.setup>, contentName: string) => {
      await screen.findByRole('combobox', { name: 'Mode' });
      await user.selectOptions(modeSelect(), 'loot_table');
      await user.selectOptions(tableSelect(), '11');
      await user.selectOptions(contentSelect(), await screen.findByRole('option', { name: contentName }));
    };

    it('adds the chosen entry, typed by the schema', async () => {
      // CSV imports store every value as a string; the form stores what the GM
      // would have got by typing the same values in.
      mockGetLootTableContents.mockResolvedValue({
        data: [{
          id: 21,
          name: 'Health Potion',
          data: JSON.stringify({ name: 'ignored', id: 'x', description: 'Restores 10 HP', quantity: '3', value: '50', weight: '', condition: 'Fine' }),
        }],
      });
      const { onAdd, user } = renderForm();
      await pick(user, 'Health Potion');
      await user.click(addButton());

      expect(onAdd).toHaveBeenCalledWith({
        // Name from the row, not the payload; id never carried over.
        name: 'Health Potion',
        values: {
          description: 'Restores 10 HP',
          quantity: 3,
          value: 50,
          // An empty CSV cell is an absent value, not zero.
          weight: undefined,
          // Unknown to the schema: kept as it is, as a server-side roll would.
          condition: 'Fine',
        },
      });
    });

    it('does not add when no entry has been chosen', async () => {
      mockGetLootTableContents.mockResolvedValue({ data: [] });
      const { onAdd, user } = renderForm();
      await screen.findByRole('combobox', { name: 'Mode' });
      await user.selectOptions(modeSelect(), 'loot_table');
      await user.click(addButton());
      expect(onAdd).not.toHaveBeenCalled();
    });

    it('refuses an entry whose stored data is malformed JSON', async () => {
      mockGetLootTableContents.mockResolvedValue({ data: [{ id: 21, name: 'Broken Item', data: 'not json{' }] });
      const { onAdd, user } = renderForm();
      await pick(user, 'Broken Item');
      await user.click(addButton());

      // GM-authored free text: bad JSON must abort the add, not throw.
      expect(onAdd).not.toHaveBeenCalled();
      expect(mockLoggerError).toHaveBeenCalled();
    });

    it('clears the chosen entry when the table is changed', async () => {
      mockGetLootTables.mockResolvedValue({
        data: [{ id: 11, game_id: 7, name: 'Common Loot' }, { id: 12, game_id: 7, name: 'Rare Loot' }],
      });
      mockGetLootTableContents.mockResolvedValue({
        data: [{ id: 21, name: 'Health Potion', data: JSON.stringify({ value: 50 }) }],
      });
      const { onAdd, user } = renderForm();
      await pick(user, 'Health Potion');

      // A stale entry from the old table must not be added against the new one.
      mockGetLootTableContents.mockResolvedValue({
        data: [{ id: 31, name: 'Dragon Scale', data: JSON.stringify({ value: 900 }) }],
      });
      await user.selectOptions(tableSelect(), '12');
      await screen.findByRole('option', { name: 'Dragon Scale' });
      expect(contentSelect()).toHaveValue('');

      await user.click(addButton());
      expect(onAdd).not.toHaveBeenCalled();
    });
  });

  describe('random mode', () => {
    it('hands up only the table id: the server picks the entry', async () => {
      const { onAdd, onAddRandom, user } = renderForm();
      await screen.findByRole('combobox', { name: 'Mode' });
      await user.selectOptions(modeSelect(), 'loot_table_random');
      await user.selectOptions(tableSelect(), '11');
      await user.click(addButton());

      expect(onAddRandom).toHaveBeenCalledWith(11);
      expect(onAdd).not.toHaveBeenCalled();
    });

    it('offers no entry picker', async () => {
      const { user } = renderForm();
      await screen.findByRole('combobox', { name: 'Mode' });
      await user.selectOptions(modeSelect(), 'loot_table_random');
      expect(screen.queryByRole('combobox', { name: 'Loot Table Content' })).not.toBeInTheDocument();
      expect(mockGetLootTableContents).not.toHaveBeenCalled();
    });

    it('does not roll when no table has been chosen', async () => {
      const { onAddRandom, user } = renderForm();
      await screen.findByRole('combobox', { name: 'Mode' });
      await user.selectOptions(modeSelect(), 'loot_table_random');
      await user.click(addButton());
      expect(onAddRandom).not.toHaveBeenCalled();
    });

    it('falls back to manual when the loot modes are withdrawn mid-edit', async () => {
      const { onAdd, onAddRandom, rerender, user } = renderForm();
      await screen.findByRole('combobox', { name: 'Mode' });
      await user.selectOptions(modeSelect(), 'loot_table_random');

      rerender(['manual']);

      // The manual form is back, and an empty name blocks the add rather than
      // a loot submit going through a picker that is no longer shown.
      expect(screen.getByRole('textbox', { name: 'Name *' })).toBeVisible();
      await user.click(addButton());
      expect(onAdd).not.toHaveBeenCalled();
      expect(onAddRandom).not.toHaveBeenCalled();
    });
  });

  /**
   * Regression: a loot table created in the game view did not show up on the
   * sheet until a page reload. The query inherited the app-wide five-minute
   * staleTime, so a list fetched before the table existed was replayed from
   * cache; and mode availability was state that latched off on an empty list.
   */
  describe('loot table freshness', () => {
    const cachedClient = (cached: unknown[]) => {
      // Mirrors the real client's defaults (see App.tsx): the default staleTime
      // is the whole point of the bug.
      const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 5 * 60 * 1000 } } });
      client.setQueryData(['lootTables', 7, true], cached);
      return client;
    };

    it('offers a loot table created after an empty list was cached', async () => {
      renderForm({ client: cachedClient([]) });
      expect(await screen.findByRole('combobox', { name: 'Mode' })).toBeInTheDocument();
      expect(mockGetLootTables).toHaveBeenCalled();
    });

    it('hides the loot modes when the game genuinely has no loot tables', async () => {
      mockGetLootTables.mockResolvedValue({ data: [] });
      renderForm({ client: cachedClient([]) });
      await waitFor(() => expect(mockGetLootTables).toHaveBeenCalled());
      expect(screen.queryByRole('combobox', { name: 'Mode' })).not.toBeInTheDocument();
    });
  });
});
