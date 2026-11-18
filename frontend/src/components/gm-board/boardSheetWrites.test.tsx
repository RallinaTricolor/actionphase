import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EntryForm } from '@/components/characters/sheet-items/EntryForm';
import { applyEntryEdit, type EntryEdit } from '@/lib/sheetEntries';
import { applyOps, editOpFrom, sheetTabsFrom } from '@/lib/gmBoard/rewards';
import type { CharacterData, SheetTab } from '@/types/characters';

// The prod incident: draft results wrote entries the sheet editor read
// differently, and the next time someone opened the sheet and saved, data was
// erased. This opens what the board writes in the sheet's own entry form and
// saves it with no changes: nothing may change.

const contacts: SheetTab = {
  key: 't_all001',
  label: 'Contacts',
  isBuiltIn: false,
  fields: [
    { key: 'rank', label: 'Rank', type: 'text' },
    { key: 'quantity', label: 'Quantity', type: 'number' },
    { key: 'description', label: 'Description', type: 'markdown' },
    { key: 'kind', label: 'Kind', type: 'select', options: ['Ally', 'Rival'] },
    { key: 'known', label: 'Known', type: 'checkbox' },
    { key: 'trust', label: 'Trust', type: 'track' },
  ],
};
const layout = [contacts];
const sheetRow = (entries: unknown[]): CharacterData =>
  ({ id: 1, character_id: 1, module_type: contacts.key, field_name: contacts.key, field_value: JSON.stringify(entries), field_type: 'json', created_at: '', updated_at: '' }) as CharacterData;

async function saveUnchanged(entry: Record<string, unknown> & { id: string; name: string }) {
  const onSubmit = vi.fn<(edit: EntryEdit) => void>();
  render(<EntryForm fields={contacts.fields} initialEntry={entry} onSubmit={onSubmit} onCancel={vi.fn()} submitLabel="Save" />);
  await userEvent.setup({ delay: null }).click(screen.getByRole('button', { name: 'Save' }));
  expect(onSubmit).toHaveBeenCalledOnce();
  return applyEntryEdit(entry, onSubmit.mock.calls[0][0]);
}

describe('an entry the results board writes, saved unchanged in the sheet editor', () => {
  it('a new entry comes back identical', async () => {
    const tabs = sheetTabsFrom([], layout);
    applyOps(
      layout,
      tabs,
      [{ act: 'add', tab: contacts.key, entry: ' Oskar ', fields: { rank: ' Tier 1 ', quantity: '2', description: 'Owes **us**', kind: 'Rival', known: 'false', trust: '3' } }],
      () => 'rw-l1-0',
    );
    const written = tabs[contacts.key][0];
    expect(await saveUnchanged(written)).toEqual(written);
  });

  it('a changed entry comes back identical', async () => {
    const tabs = sheetTabsFrom([sheetRow([{ id: 'm1', name: 'Mara', quantity: 2, known: true, trust: { value: 2, max: 5, display: 'boxes' } }])], layout);
    applyOps(
      layout,
      tabs,
      [
        { act: 'inc', tab: contacts.key, entry: 'Mara', field: 'trust', by: -1 },
        { act: 'inc', tab: contacts.key, entry: 'Mara', field: 'quantity', by: -2 },
        { act: 'set', tab: contacts.key, entry: 'Mara', field: 'known', value: 'false' },
        { act: 'set', tab: contacts.key, entry: 'Mara', field: 'rank', value: ' Tier 2 ' },
      ],
      () => 'x',
    );
    const written = tabs[contacts.key][0];
    expect(written).toEqual({ id: 'm1', name: 'Mara', quantity: 0, rank: 'Tier 2', trust: { value: 1, max: 5, display: 'boxes' } });
    expect(await saveUnchanged(written)).toEqual(written);
  });

  it('an entry edited through the sheet’s own form, as an Edit entry op, comes back identical', async () => {
    const stored = { id: 'm1', name: 'Mara', rank: ' Tier 1 ', quantity: 2, trust: { value: 2, max: 5, display: 'boxes' } };
    const tabs = sheetTabsFrom([sheetRow([stored])], layout);
    const edit: EntryEdit = { name: 'Mara Vey', values: { rank: 'Tier 1', quantity: 4, description: 'Owes us', kind: undefined, known: true, trust: { value: 3, max: 5, display: 'boxes' } } };
    applyOps(layout, tabs, [editOpFrom(contacts, tabs[contacts.key][0], edit)], () => 'x');
    const written = tabs[contacts.key][0];
    expect(written).toEqual({ id: 'm1', name: 'Mara Vey', rank: 'Tier 1', quantity: 4, description: 'Owes us', known: true, trust: { value: 3, max: 5, display: 'boxes' } });
    expect(await saveUnchanged(written)).toEqual(written);
  });
});
