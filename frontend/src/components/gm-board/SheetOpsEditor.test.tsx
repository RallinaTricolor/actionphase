import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { resolveSheetLayout } from '@/hooks/useSheetLayout';
import { SheetOpsEditor } from './SheetOpsEditor';

const layout = resolveSheetLayout(null).tabs;

describe('SheetOpsEditor', () => {
  it('starts a new sheet change on the Numbers tab in the default layout', async () => {
    const onChange = vi.fn();
    render(<SheetOpsEditor ops={[]} onChange={onChange} layout={layout} entryNames={() => []} idPrefix="t" />);
    await userEvent.click(screen.getByRole('button', { name: '+ Sheet change' }));
    expect(onChange).toHaveBeenCalledWith([{ act: 'inc', tab: 'numbers', entry: '', by: 1 }]);
  });

  it('starts the next change on the tab the last one used', async () => {
    const onChange = vi.fn();
    const ops = [{ act: 'remove' as const, tab: 'inventory', entry: 'Rope' }];
    render(<SheetOpsEditor ops={ops} onChange={onChange} layout={layout} entryNames={() => ['Rope']} idPrefix="t" />);
    expect(screen.getByLabelText('Tab')).toHaveValue('inventory');
    await userEvent.click(screen.getByRole('button', { name: '+ Sheet change' }));
    expect(onChange).toHaveBeenCalledWith([...ops, { act: 'inc', tab: 'inventory', entry: '', by: 1 }]);
  });
});
