import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';
import { renderWithProviders } from '@/test-utils';
import type { CharacterData, CharacterSheetConfig } from '@/types/characters';
import { CharacterSheetEditor } from './CharacterSheetEditor';

const GAME_ID = 7;

function dataRow(characterId: number, moduleType: string, fieldName: string, entries: unknown[]): CharacterData {
  return {
    id: characterId,
    character_id: characterId,
    module_type: moduleType,
    field_name: fieldName,
    field_value: JSON.stringify(entries),
    field_type: 'json',
    created_at: '',
    updated_at: '',
  } as CharacterData;
}

/**
 * Serves the cast's sheet data and records every save. A save echoes the body
 * back as the game's stored layout, as the backend does after normalizing.
 */
function setup(cast: Record<string, CharacterData[]> = {}, lootTargets: string[] = []) {
  const saved: CharacterSheetConfig[] = [];
  let reject: { status: number; body: Record<string, unknown> } | null = null;
  server.use(
    http.get(`/api/v1/games/${GAME_ID}/characters/data`, () => HttpResponse.json(cast)),
    http.get(`/api/v1/games/${GAME_ID}/loot-tables`, () =>
      HttpResponse.json(lootTargets.map((target_tab, i) => ({
        id: i + 1, game_id: GAME_ID, name: `Table ${i + 1}`, target_tab, created_at: '', updated_at: '',
      }))),
    ),
    http.put(`/api/v1/games/${GAME_ID}/character-sheet`, async ({ request }) => {
      if (reject) return HttpResponse.json(reject.body, { status: reject.status });
      const body = (await request.json()) as CharacterSheetConfig;
      saved.push(body);
      return HttpResponse.json({ id: GAME_ID, title: 'Game', character_sheet: Object.keys(body).length ? body : undefined });
    }),
  );
  return {
    saved,
    rejectWith: (status: number, body: Record<string, unknown>) => {
      reject = { status, body };
    },
  };
}

const renderEditor = (config?: CharacterSheetConfig, onDirtyChange = vi.fn()) => {
  const { queryClient } = renderWithProviders(
    <CharacterSheetEditor gameId={GAME_ID} config={config} onDirtyChange={onDirtyChange} />,
  );
  // Removal prompts count from the cast's data; until it lands they can't.
  const castLoaded = () =>
    waitFor(() => expect(queryClient.getQueryData(['gameCharacterData', GAME_ID])).toBeDefined());
  return { user: userEvent.setup({ delay: null }), onDirtyChange, castLoaded };
};

const tabList = () => screen.getByTestId('sheet-tab-list');
// The name on each configurable tab's row, in order.
const tabNames = () =>
  screen.getAllByTestId(/^sheet-tab-row-/).map((row) => within(row).getAllByRole('button')[0].textContent);
const saveButton = () => screen.getByTestId('save-character-sheet');
const selectTab = (user: ReturnType<typeof userEvent.setup>, name: string) =>
  user.click(within(tabList()).getByRole('button', { name }));

describe('CharacterSheetEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the fixed tabs locked, then the layout, with the first tab open and nothing to save', () => {
    setup();
    renderEditor();

    const list = tabList();
    expect(within(list).getByText('Public Profile')).toBeInTheDocument();
    expect(within(list).getByText('Private Notes')).toBeInTheDocument();
    expect(within(list).getAllByText('Always shown')).toHaveLength(2);
    expect(tabNames()).toEqual(['Skills', 'Inventory', 'Numbers']);

    // A built-in tab's name falls back to its default when cleared.
    expect(screen.getByRole('textbox', { name: 'Tab name' })).toHaveValue('Skills');
    expect(screen.getByRole('textbox', { name: 'Tab name' })).toHaveAttribute('placeholder', 'Skills');
    expect(screen.getAllByRole('textbox', { name: 'Field name' }).map((i) => (i as HTMLInputElement).value))
      .toEqual(['Rank', 'Category', 'Description']);
    expect(saveButton()).toBeDisabled();
  });

  it('saves a renamed tab sparsely, and has nothing left to save afterwards', async () => {
    const { saved } = setup();
    const { user, onDirtyChange } = renderEditor();

    await user.clear(screen.getByRole('textbox', { name: 'Tab name' }));
    await user.type(screen.getByRole('textbox', { name: 'Tab name' }), 'Talents');
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
    await user.click(saveButton());

    await waitFor(() => expect(saved).toHaveLength(1));
    expect(saved[0]).toEqual({ tabs: [{ key: 'skills', label: 'Talents' }, { key: 'inventory' }, { key: 'numbers' }] });
    expect(await screen.findByText('Character sheet saved')).toBeInTheDocument();
    await waitFor(() => expect(saveButton()).toBeDisabled());
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);
  });

  it('adds a custom tab with a description field, and a choice field to it', async () => {
    const { saved } = setup();
    const { user } = renderEditor();

    await user.click(within(tabList()).getByRole('button', { name: 'Add tab' }));
    await user.type(screen.getByRole('textbox', { name: 'New tab name' }), 'Contacts');
    await user.click(within(tabList()).getByRole('button', { name: 'Add tab' }));

    // The new tab is opened, starting with a description.
    expect(screen.getByRole('textbox', { name: 'Tab name' })).toHaveValue('Contacts');
    expect(screen.getAllByRole('textbox', { name: 'Field name' }).map((i) => (i as HTMLInputElement).value)).toEqual(['Description']);

    await user.click(screen.getByRole('button', { name: 'Add field' }));
    const form = screen.getByTestId('add-sheet-field-form');
    await user.type(within(form).getByRole('textbox', { name: 'Field name' }), 'Relationship');
    await user.selectOptions(within(form).getByRole('combobox', { name: 'Type' }), 'select');
    await user.type(within(form).getByRole('textbox', { name: 'Options' }), 'Ally{Enter}Rival');
    await user.click(within(form).getByRole('button', { name: 'Add field' }));

    // The preview renders an entry with the new schema.
    expect(within(screen.getByText('Preview').closest('div')!.parentElement!.parentElement!).getByText('Ally')).toBeInTheDocument();

    await user.click(saveButton());
    await waitFor(() => expect(saved).toHaveLength(1));
    const custom = saved[0].tabs!.at(-1)!;
    expect(custom.key).toMatch(/^t_[a-z0-9]{6}$/);
    expect(custom.label).toBe('Contacts');
    expect(custom.fields).toEqual([
      { key: 'description', label: 'Description', type: 'markdown' },
      { key: expect.stringMatching(/^f_[a-z0-9]{6}$/), label: 'Relationship', type: 'select', options: ['Ally', 'Rival'] },
    ]);
  });

  it('will not add a choice field with no options', async () => {
    setup();
    const { user } = renderEditor();

    await user.click(screen.getByRole('button', { name: 'Add field' }));
    const form = screen.getByTestId('add-sheet-field-form');
    await user.type(within(form).getByRole('textbox', { name: 'Field name' }), 'Mood');
    await user.selectOptions(within(form).getByRole('combobox', { name: 'Type' }), 'select');
    await user.click(within(form).getByRole('button', { name: 'Add field' }));

    expect(within(form).getByText('A choice needs at least one option.')).toBeInTheDocument();
    expect(screen.getAllByRole('textbox', { name: 'Field name' })).toHaveLength(4); // 3 fields + the form's
  });

  describe('removal', () => {
    const cast = {
      '1': [dataRow(1, 'inventory', 'items', [{ id: 'a', name: 'Rope', weight: 2 }])],
      '2': [dataRow(2, 'inventory', 'items', [{ id: 'b', name: 'Lamp', weight: 1 }])],
    };

    it('asks before removing a field characters have values in, counting them', async () => {
      setup(cast);
      const { user, castLoaded } = renderEditor();
      await castLoaded();
      await selectTab(user, 'Inventory');

      await user.click(screen.getByRole('button', { name: 'Remove Weight' }));
      const confirm = screen.getByRole('alertdialog');
      expect(confirm).toHaveTextContent(
        "2 characters have a value in this field. It'll be hidden, not deleted. Restoring the default field shows it again.",
      );
      await user.click(within(confirm).getByRole('button', { name: 'Remove' }));

      expect(screen.queryByTestId('sheet-field-weight')).not.toBeInTheDocument();
      // A built-in tab offers its default field back; the key, and so the data, is the same.
      await user.click(screen.getByRole('button', { name: 'Weight' }));
      expect(screen.getByTestId('sheet-field-weight')).toBeInTheDocument();
    });

    it('removes a field nobody has a value in without asking', async () => {
      setup(cast);
      const { user, castLoaded } = renderEditor();
      await castLoaded();
      await selectTab(user, 'Inventory');

      await user.click(screen.getByRole('button', { name: 'Remove Value' }));
      expect(screen.queryByTestId('sheet-field-value')).not.toBeInTheDocument();
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });

    it('asks before removing a tab with entries, and offers a built-in tab back', async () => {
      setup(cast);
      const { user, castLoaded } = renderEditor();
      await castLoaded();

      await user.click(within(tabList()).getByRole('button', { name: 'Remove Inventory' }));
      expect(screen.getByRole('alertdialog')).toHaveTextContent('2 characters have entries here.');
      await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Remove' }));
      expect(tabNames()).toEqual(['Skills', 'Numbers']);

      await user.click(within(tabList()).getByRole('button', { name: 'Inventory' }));
      expect(tabNames()).toEqual(['Skills', 'Numbers', 'Inventory']);
    });
  });

  it("won't remove a tab loot tables roll into, and points at them", async () => {
    setup({}, ['inventory', 'inventory', 'skills']);
    renderEditor();

    const remove = within(tabList()).getByRole('button', { name: 'Remove Inventory' });
    await waitFor(() => expect(remove).toBeDisabled());
    // The note the disabled button points assistive tech at.
    expect(document.getElementById(remove.getAttribute('aria-describedby')!))
      .toHaveTextContent('Used by 2 loot tables. Retarget or delete them to remove this tab.');
    expect(within(tabList()).getByRole('link', { name: '2 loot tables' })).toHaveAttribute('href', `/games/${GAME_ID}?tab=loot_tables`);
    expect(within(tabList()).getByRole('button', { name: 'Remove Skills' })).toBeDisabled();
    expect(within(tabList()).getByRole('link', { name: '1 loot table' })).toBeInTheDocument();
    expect(within(tabList()).getByRole('button', { name: 'Remove Numbers' })).toBeEnabled();
  });

  it('shows the reason the server gives outside errors[], such as a loot table still using a tab', async () => {
    const { rejectWith } = setup();
    const reason = 'Inventory is used by loot table "Chest". Retarget or delete those tables before removing the tab.';
    rejectWith(422, { title: 'Unprocessable Entity', status: 422, detail: reason });
    const { user, castLoaded } = renderEditor();
    await castLoaded();

    await user.click(within(tabList()).getByRole('button', { name: 'Remove Numbers' }));
    await user.click(saveButton());

    expect(await screen.findByText(reason)).toBeInTheDocument();
  });

  it('asks before a removal while the counts are still loading', async () => {
    setup();
    server.use(http.get(`/api/v1/games/${GAME_ID}/characters/data`, () => new Promise<never>(() => {})));
    const { user } = renderEditor();

    await user.click(within(tabList()).getByRole('button', { name: 'Remove Numbers' }));
    expect(screen.getByRole('alertdialog')).toHaveTextContent('Any entries here will be hidden, not deleted.');
  });

  it('reorders tabs', async () => {
    const { saved } = setup();
    const { user } = renderEditor();

    await user.click(screen.getByRole('button', { name: 'Move Numbers up' }));
    expect(tabNames()).toEqual(['Skills', 'Numbers', 'Inventory']);
    expect(screen.getByRole('button', { name: 'Move Skills up' })).toBeDisabled();

    await user.click(saveButton());
    await waitFor(() => expect(saved[0]).toEqual({ tabs: [{ key: 'skills' }, { key: 'numbers' }, { key: 'inventory' }] }));
  });

  it('reorders fields', async () => {
    setup();
    const { user } = renderEditor();

    await user.click(screen.getByRole('button', { name: 'Move Description up' }));
    expect(screen.getAllByRole('textbox', { name: 'Field name' }).map((i) => (i as HTMLInputElement).value))
      .toEqual(['Rank', 'Description', 'Category']);
  });

  it('blocks saving while a field has no name, and says where', async () => {
    setup();
    const { user } = renderEditor();

    await user.clear(screen.getAllByRole('textbox', { name: 'Field name' })[0]);

    expect(screen.getByText('Field name: Needs a name.')).toBeInTheDocument();
    expect(screen.getByTestId('sheet-editor-problems')).toBeInTheDocument();
    expect(saveButton()).toBeDisabled();
  });

  it("shows the server's reason when it rejects the layout", async () => {
    const { rejectWith } = setup();
    rejectWith(422, {
      title: 'Unprocessable Entity',
      status: 422,
      detail: 'validation failed',
      errors: [{ message: 'tab "t_abc123" needs a label', location: 'body' }],
    });
    const { user } = renderEditor();

    await user.clear(screen.getByRole('textbox', { name: 'Tab name' }));
    await user.type(screen.getByRole('textbox', { name: 'Tab name' }), 'Talents');
    await user.click(saveButton());

    expect(await screen.findByText('tab "t_abc123" needs a label')).toBeInTheDocument();
    expect(saveButton()).toBeEnabled();
  });

  it('resets a customised layout to the default, which saves as an empty config', async () => {
    const { saved } = setup();
    const { user } = renderEditor({
      tabs: [{ key: 't_abc123', label: 'Contacts', fields: [] }, { key: 'skills', label: 'Talents' }],
    });
    expect(tabNames()).toEqual(['Contacts', 'Talents']);

    await user.click(screen.getByRole('button', { name: 'Reset to default' }));
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Reset' }));
    expect(tabNames()).toEqual(['Skills', 'Inventory', 'Numbers']);

    await user.click(saveButton());
    await waitFor(() => expect(saved[0]).toEqual({}));
  });

  it('carries a legacy label into the editor and keeps it on save', async () => {
    const { saved } = setup();
    const { user } = renderEditor({ labels: { inventory: 'Gear' } });
    expect(tabNames()).toEqual(['Skills', 'Gear', 'Numbers']);

    // A change elsewhere; the legacy name must survive the switch to `tabs`.
    await user.click(screen.getByRole('button', { name: 'Move Numbers up' }));
    await user.click(saveButton());
    await waitFor(() =>
      expect(saved[0]).toEqual({ tabs: [{ key: 'skills' }, { key: 'numbers' }, { key: 'inventory', label: 'Gear' }] }),
    );
  });
});
