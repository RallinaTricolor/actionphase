import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { makeCard } from '@/test-utils/factories';
import { MapChecks } from './MapChecks';
import { testModel } from './mapTestModel';

const board = {
  cards: [
    makeCard({ id: 'p', characterId: 2, locationId: 'mill', chunkId: 'k2', summary: 'Burns the ledger' }),
    makeCard({ id: 'a', characterId: 1, locationId: 'dock', chunkId: 'k3', outcome: 'happened' as const }),
    makeCard({ id: 'b', characterId: 3, locationId: 'dock', chunkId: 'k3', outcome: 'happened' as const }),
  ],
};

function renderChecks(dismissed: Record<string, true> = {}) {
  const handlers = { onOpenCard: vi.fn(), onResolveAt: vi.fn(), onDismiss: vi.fn(), onRestore: vi.fn() };
  render(<MapChecks model={testModel({ ...board, dismissedFlags: dismissed })} {...handlers} />);
  return handlers;
}

describe('MapChecks', () => {
  it('lists each open check as a sentence, opening its card or its slot', async () => {
    const h = renderChecks();
    const pending = screen.getByText('Mara Quill’s card in Slot 1 has no outcome: “Burns the ledger”.').closest('li') as HTMLElement;
    await userEvent.click(within(pending).getByRole('button', { name: 'Open card' }));
    expect(h.onOpenCard).toHaveBeenCalledWith('p');
    const meeting = screen.getByText('Harrison Vale, Ilse are at dock in Slot 2, with no scene.').closest('li') as HTMLElement;
    await userEvent.click(within(meeting).getByRole('button', { name: 'Show' }));
    expect(h.onResolveAt).toHaveBeenCalledWith('k3');
  });

  it('dismisses a check, and restores one from Dismissed', async () => {
    const h = renderChecks({ 'meet:dock:k3': true });
    expect(screen.queryByText(/are at dock/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /^Dismiss: Mara Quill’s card/ }));
    expect(h.onDismiss).toHaveBeenCalledWith(expect.objectContaining({ key: 'pend:p' }));
    await userEvent.click(screen.getByRole('button', { name: '▸ Dismissed (1)' }));
    await userEvent.click(screen.getByRole('button', { name: /^Restore: Harrison Vale, Ilse/ }));
    expect(h.onRestore).toHaveBeenCalledWith(expect.objectContaining({ key: 'meet:dock:k3' }));
  });

  it('says when there is nothing to check', () => {
    render(<MapChecks model={testModel()} onOpenCard={vi.fn()} onResolveAt={vi.fn()} onDismiss={vi.fn()} onRestore={vi.fn()} />);
    expect(screen.getByText('Nothing to check.')).toBeInTheDocument();
  });
});
