import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { resolveSheetLayout } from '@/hooks/useSheetLayout';
import { lineSteps, type SheetTabs } from '@/lib/gmBoard/rewards';
import type { SheetOp } from '@/lib/gmBoard/types';
import { server } from '@/mocks/server';
import { renderWithProviders } from '@/test-utils/render';
import { SheetOpsEditor } from './SheetOpsEditor';

const layout = resolveSheetLayout(null).tabs;
const API = 'http://localhost:3000/api/v1';

const live = (): SheetTabs => ({
  skills: [],
  numbers: [],
  inventory: [
    { id: 'i1', name: 'Rope', quantity: 1, category: 'Tools' },
    { id: 'i2', name: 'Lantern', quantity: 1 },
  ],
});

/** The editor as a line editor holds it: ops in state, worked out on one character's sheet. */
function Harness({ initial, sheet, onOps }: { initial: SheetOp[]; sheet?: SheetTabs; onOps?: (ops: SheetOp[]) => void }) {
  const [ops, setOps] = useState(initial);
  const steps = sheet ? lineSteps(layout, sheet, [], { id: 'l1', group: 'other', text: '', ops, choose: false }) : undefined;
  return (
    <SheetOpsEditor
      ops={ops}
      onChange={(next) => {
        setOps(next);
        onOps?.(next);
      }}
      layout={layout}
      entryNames={() => ['Rope']}
      steps={steps?.steps}
      recs={steps?.recs}
      idPrefix="t"
    />
  );
}

describe('SheetOpsEditor', () => {
  it('starts a new sheet change on the Numbers tab in the default layout', async () => {
    const onChange = vi.fn();
    render(<SheetOpsEditor ops={[]} onChange={onChange} layout={layout} entryNames={() => []} idPrefix="t" />);
    await userEvent.click(screen.getByRole('button', { name: '+ Change' }));
    expect(onChange).toHaveBeenCalledWith([{ act: 'inc', tab: 'numbers', entry: '', by: 1 }]);
  });

  it('starts the next change on the tab the last one used', async () => {
    const onChange = vi.fn();
    const ops = [{ act: 'remove' as const, tab: 'inventory', entry: 'Rope' }];
    render(<SheetOpsEditor ops={ops} onChange={onChange} layout={layout} entryNames={() => ['Rope']} idPrefix="t" />);
    expect(screen.getByLabelText('Tab')).toHaveValue('inventory');
    await userEvent.click(screen.getByRole('button', { name: '+ Change' }));
    expect(onChange).toHaveBeenCalledWith([...ops, { act: 'inc', tab: 'inventory', entry: '', by: 1 }]);
  });

  it('offers Edit entry only on one character’s sheet, which a list item doesn’t have', () => {
    const op: SheetOp = { act: 'remove', tab: 'inventory', entry: 'Rope' };
    const { unmount } = render(<Harness initial={[op]} />);
    expect(within(screen.getByLabelText('Change')).queryByRole('option', { name: 'Edit entry' })).not.toBeInTheDocument();
    unmount();
    render(<Harness initial={[op]} sheet={live()} />);
    expect(within(screen.getByLabelText('Change')).getByRole('option', { name: 'Edit entry' })).toBeInTheDocument();
  });

  it('says what each change does to the character, or why it can’t', () => {
    render(
      <Harness
        sheet={live()}
        initial={[
          { act: 'inc', tab: 'inventory', entry: 'rope', field: 'quantity', by: -1 },
          { act: 'remove', tab: 'inventory', entry: 'Grapnel' },
        ]}
      />,
    );
    expect(screen.getByTestId('t-outcome-0')).toHaveTextContent('Rope · Quantity: 1 → 0');
    expect(screen.getByTestId('t-outcome-1')).toHaveTextContent('There’s no Inventory entry named “Grapnel”');
    expect(screen.getByTestId('t-entry-1-tag')).toHaveTextContent('Not on the sheet');
  });

  it('edits an entry in the sheet’s own form, opened on the entry as it stands, keeping only what changed', async () => {
    const user = userEvent.setup();
    const onOps = vi.fn();
    render(
      <Harness
        sheet={live()}
        onOps={onOps}
        initial={[
          { act: 'inc', tab: 'inventory', entry: 'Rope', field: 'quantity', by: 2 },
          { act: 'edit', tab: 'inventory', entry: 'Rope', values: {} },
        ]}
      />,
    );
    expect(screen.getByTestId('t-edit-1')).toHaveTextContent('No changes yet.');
    await user.click(screen.getByRole('button', { name: 'Edit Rope' }));
    const form = screen.getByTestId('t-edit-1-form');
    // The earlier change is already in: Rope has 3.
    expect(within(form).getByLabelText('Quantity')).toHaveValue(3);
    await user.clear(within(form).getByLabelText('Category'));
    await user.type(within(form).getByLabelText('Category'), 'Climbing');
    await user.click(within(form).getByRole('button', { name: 'Save' }));

    expect(onOps).toHaveBeenLastCalledWith([expect.anything(), { act: 'edit', tab: 'inventory', entry: 'Rope', values: { category: 'Climbing' } }]);
    expect(screen.getByTestId('t-edit-1')).toHaveTextContent('Category: Tools → Climbing');
  });

  it('makes a new entry in the sheet’s own add form, then shows it as the sheet will', async () => {
    const user = userEvent.setup();
    const onOps = vi.fn();
    renderWithProviders(<Harness sheet={live()} onOps={onOps} initial={[{ act: 'add', tab: 'inventory', entry: '', fields: {} }]} />);
    const form = screen.getByTestId('t-new-0-form');
    await user.type(within(form).getByLabelText('Name *'), ' Lockpicks ');
    await user.type(within(form).getByLabelText('Quantity'), '2');
    await user.click(within(form).getByRole('button', { name: 'Add' }));

    expect(onOps).toHaveBeenLastCalledWith([{ act: 'add', tab: 'inventory', entry: 'Lockpicks', fields: { quantity: 2 } }]);
    expect(within(screen.getByTestId('t-new-0')).getByText('Lockpicks')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit new entry' })).toBeInTheDocument();
  });

  it('rolls a new entry on a loot table into the change itself, so working it out again never rerolls', async () => {
    const user = userEvent.setup();
    const onOps = vi.fn();
    let draws = 0;
    let gave = false;
    server.use(
      http.get(`${API}/games/:gameId/loot-tables`, () =>
        HttpResponse.json([{ id: 4, game_id: 1, name: 'Common Loot', target_tab: 'inventory', created_at: '', updated_at: '' }]),
      ),
      http.post(`${API}/games/:gameId/loot-tables/:tableId/draw`, () => {
        draws += 1;
        return HttpResponse.json({ id: 9, loot_table_id: 4, name: 'Silver Key', data: '{"id":"srv-1","name":"Silver Key","quantity":"1","category":"Keys"}' });
      }),
      http.post(`${API}/games/:gameId/loot-tables/:tableId/random/:characterId`, () => {
        gave = true;
        return HttpResponse.json({});
      }),
    );
    renderWithProviders(<Harness sheet={live()} onOps={onOps} initial={[{ act: 'add', tab: 'inventory', entry: '', fields: {} }]} />, { gameId: 1 });

    await user.selectOptions(await screen.findByRole('combobox', { name: 'Mode' }), 'loot_table_random');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Loot Table' }), '4');
    await user.click(screen.getByRole('button', { name: 'Add' }));

    expect(await within(await screen.findByTestId('t-new-0')).findByText('Silver Key')).toBeInTheDocument();
    expect(onOps).toHaveBeenLastCalledWith([{ act: 'add', tab: 'inventory', entry: 'Silver Key', fields: { quantity: 1, category: 'Keys' } }]);
    expect(draws).toBe(1);
    expect(gave).toBe(false);
  });
});
