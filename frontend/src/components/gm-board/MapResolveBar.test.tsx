import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { makeCard } from '@/test-utils/factories';
import { MapResolveBar } from './MapResolveBar';
import { testActions, testModel } from './mapTestModel';

const cards = [
  makeCard({ id: 'a', characterId: 1, locationId: 'mill', chunkId: 'k2', outcome: 'happened' }),
  makeCard({ id: 'b', characterId: 2, locationId: 'mill', chunkId: 'k2', outcome: 'happened' }),
  makeCard({ id: 'w', characterId: 2, locationId: 'dock', chunkId: null, isIF: true, cond: 'he runs', summary: 'Chases him' }),
  makeCard({ id: 'x', characterId: 3, locationId: 'dock', chunkId: null, isIF: true, cond: 'it rains', summary: 'Stays in' }),
];

function renderBar(chunkId = 'k2') {
  const actions = testActions();
  const onClose = vi.fn();
  render(<MapResolveBar model={testModel({ cards }, { resolving: chunkId })} chunkId={chunkId} actions={actions} onClose={onClose} />);
  return { actions, onClose };
}

describe('MapResolveBar', () => {
  it('lists the slot’s busy cells and checks', () => {
    renderBar();
    expect(screen.getByRole('heading', { name: 'Resolving Slot 1' })).toBeInTheDocument();
    expect(screen.getByText('the Old Mill: Harrison, Mara · no scene')).toBeInTheDocument();
    expect(screen.getByText('Harrison Vale, Mara Quill are at the Old Mill in Slot 1, with no scene.')).toBeInTheDocument();
  });

  it('offers only the waiting IF cards of people here, and “here ▸” triggers one in this slot', async () => {
    const { actions } = renderBar();
    expect(screen.getByText('IF he runs')).toBeInTheDocument();
    expect(screen.queryByText('IF it rains')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Trigger it here, in Slot 1' }));
    expect(actions.moveCard).toHaveBeenCalledWith(cards[2], { chunkId: 'k2' });
  });

  it('steps through the slots, and Done stops', async () => {
    const { actions, onClose } = renderBar('k1');
    expect(screen.getByRole('button', { name: '← Previous' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Next →' }));
    expect(actions.resolveAt).toHaveBeenCalledWith('k2');
    expect(screen.getByRole('button', { name: 'Slot 1 · 1' })).toBeInTheDocument();
    expect(screen.getByText('Nothing left to resolve in this slot.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(onClose).toHaveBeenCalled();
  });
});
