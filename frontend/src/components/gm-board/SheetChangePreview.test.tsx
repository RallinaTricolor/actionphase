import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { resolveSheetLayout } from '@/hooks/useSheetLayout';
import { SheetChangePreview } from './SheetChangePreview';

const layout = resolveSheetLayout(null).tabs;

describe('SheetChangePreview', () => {
  const before = {
    inventory: [
      { id: 'i1', name: 'Rope', quantity: 1 },
      { id: 'i2', name: 'Darts', quantity: 4 },
      { id: 'i3', name: 'Lantern' },
    ],
    skills: [{ id: 's1', name: 'Bane' }],
  };
  const after = {
    inventory: [
      { id: 'i1', name: 'Rope', quantity: 1 },
      { id: 'i3', name: 'Lantern' },
      { id: 'n1', name: 'Silver Key', category: 'Keys' },
    ],
    skills: [{ id: 's1', name: 'Bane' }],
  };

  it('shows only the tabs given, each entry in sheet order and marked by what happens to it', () => {
    render(<SheetChangePreview layout={layout} before={before} after={after} tabKeys={['inventory']} />);
    expect(screen.queryByTestId('preview-tab-skills')).not.toBeInTheDocument();
    const tab = screen.getByTestId('preview-tab-inventory');
    expect(within(tab).getAllByRole('listitem').map((li) => li.getAttribute('data-testid') ?? li.textContent)).toEqual(['Rope', 'preview-removed', 'Lantern', 'preview-new']);
    expect(within(screen.getByTestId('preview-removed')).getByText('Darts')).toBeInTheDocument();
    expect(within(screen.getByTestId('preview-new')).getByText('Keys')).toBeInTheDocument();
  });

  it('gives each changed field before and after', () => {
    render(
      <SheetChangePreview
        layout={layout}
        before={{ inventory: [{ id: 'i2', name: 'Darts', quantity: 4 }] }}
        after={{ inventory: [{ id: 'i2', name: 'Tranq Darts', quantity: 2 }] }}
        tabKeys={['inventory']}
      />,
    );
    expect(screen.getByTestId('preview-changed')).toHaveTextContent('Name: Darts → Tranq Darts · Quantity: 4 → 2');
  });
});
