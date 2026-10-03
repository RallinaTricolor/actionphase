import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AddEntryModal } from './AddEntryModal';

vi.mock('@/contexts/GameContext', () => ({
  useOptionalGameContext: () => undefined,
}));

vi.mock('@/lib/api', () => ({
  apiClient: {
    games: {
      getLootTables: vi.fn(() => Promise.resolve({ data: [] })),
      getLootTableContents: vi.fn(() => Promise.resolve({ data: [] })),
    },
  },
}));

const clickBackdrop = () => {
  const backdrop = document.querySelector('.bg-black\\/60') as HTMLElement;
  expect(backdrop).toBeInTheDocument();
  fireEvent.click(backdrop);
};

const withQuery = (ui: React.ReactNode) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    {ui}
  </QueryClientProvider>
);

/**
 * Every Add-* modal holds a form whose contents live only in local component state —
 * nothing is staged or persisted until Submit. A backdrop click is a slip rather than a
 * decision, so it must not be a path that discards a half-typed entry.
 */
describe('Add modals ignore backdrop clicks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('AddEntryModal does not cancel on a backdrop click', () => {
    const onCancel = vi.fn();
    render(<AddEntryModal fields={[]} onAdd={vi.fn()} onCancel={onCancel} />);

    clickBackdrop();

    expect(onCancel).not.toHaveBeenCalled();
  });

  it('AddEntryModal with loot modes does not cancel on a backdrop click', () => {
    const onCancel = vi.fn();
    render(
      withQuery(
        <AddEntryModal
          fields={[]}
          onAdd={vi.fn()}
          onAddRandom={vi.fn()}
          onCancel={onCancel}
          lootModes={['manual', 'loot_table', 'loot_table_random']}
        />,
      ),
    );

    clickBackdrop();

    expect(onCancel).not.toHaveBeenCalled();
  });
});
