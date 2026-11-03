import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { makeCard, makeScene } from '@/test-utils/factories';
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
  const handlers = { onOpenCard: vi.fn(), onResolveAt: vi.fn(), onDismiss: vi.fn(), onRestore: vi.fn(), onCreateScene: vi.fn(), onOpenScene: vi.fn() };
  render(<MapChecks model={testModel({ ...board, dismissedFlags: dismissed })} {...handlers} />);
  return handlers;
}

describe('MapChecks', () => {
  it('lists each open check as a sentence, opening its card, or making a scene where people meet', async () => {
    const h = renderChecks();
    const pending = screen.getByText('Mara Quill’s card in Slot 1 has no outcome: “Burns the ledger”.').closest('li') as HTMLElement;
    await userEvent.click(within(pending).getByRole('button', { name: 'Open card' }));
    expect(h.onOpenCard).toHaveBeenCalledWith('p');
    const meeting = screen.getByText('Harrison Vale, Ilse are at dock in Slot 2, with no scene.').closest('li') as HTMLElement;
    await userEvent.click(within(meeting).getByRole('button', { name: 'Create scene' }));
    expect(h.onCreateScene).toHaveBeenCalledWith('dock', 'k3');
  });

  it('opens the scene that someone out of play is in', async () => {
    const handlers = { onOpenCard: vi.fn(), onResolveAt: vi.fn(), onDismiss: vi.fn(), onRestore: vi.fn(), onCreateScene: vi.fn(), onOpenScene: vi.fn() };
    const scenes = [
      makeScene({ id: 'fight', locationId: 'dock', chunkId: 'k1', participants: [1], effects: [{ characterId: 1, state: 'captured' as const }] }),
      makeScene({ id: 'later', locationId: 'mill', chunkId: 'k3', participants: [1] }),
    ];
    render(<MapChecks model={testModel({ scenes })} {...handlers} />);
    const out = screen.getByText('Harrison Vale is captured but is in a scene in Slot 2.').closest('li') as HTMLElement;
    await userEvent.click(within(out).getByRole('button', { name: 'Open scene' }));
    expect(handlers.onOpenScene).toHaveBeenCalledWith('later');
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
    renderChecks();
    expect(screen.queryByText('Nothing to check.')).not.toBeInTheDocument();
    render(<MapChecks model={testModel()} onOpenCard={vi.fn()} onResolveAt={vi.fn()} onDismiss={vi.fn()} onRestore={vi.fn()} onCreateScene={vi.fn()} onOpenScene={vi.fn()} />);
    expect(screen.getByText('Nothing to check.')).toBeInTheDocument();
  });
});
