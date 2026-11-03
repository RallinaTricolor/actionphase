import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { makeBoard, makeCard } from '@/test-utils/factories';
import type { Cluster } from '@/lib/gmBoard/types';
import { ClusterEditor } from './ClusterEditor';
import { CAST } from './mapTestModel';

const players = CAST.filter((c) => !c.npc);

function renderEditor(clusters: Cluster[] = []) {
  const handlers = { onSave: vi.fn(), onRemove: vi.fn(), onCreate: vi.fn() };
  const board = makeBoard({
    clusters,
    cards: [
      makeCard({ id: 'a', characterId: 1, locationId: 'mill', chunkId: 'k2' }),
      makeCard({ id: 'b', characterId: 2, locationId: 'mill', chunkId: 'k2' }),
    ],
  });
  render(<ClusterEditor board={board} players={players} {...handlers} />);
  return handlers;
}

describe('ClusterEditor', () => {
  it('suggests players who share a cell, and makes a cluster of them', async () => {
    const { onCreate } = renderEditor();
    await userEvent.click(screen.getByRole('button', { name: 'Make cluster' }));
    expect(onCreate).toHaveBeenCalledWith('Harrison & Mara', [1, 2]);
  });

  it('drops a suggestion once it is a cluster', () => {
    renderEditor([{ id: 'cl', name: 'Mill', characterIds: [2, 1] }]);
    expect(screen.queryByText('Groups that share a cell')).not.toBeInTheDocument();
  });

  it('moves a player between clusters, one cluster each', async () => {
    const one = { id: 'c1', name: 'One', characterIds: [1] };
    const two = { id: 'c2', name: 'Two', characterIds: [3] };
    const { onSave, onRemove } = renderEditor([one, two]);
    const section = screen.getByRole('region', { name: 'Cluster Two' });
    await userEvent.click(within(section).getByLabelText('Harrison Vale'));
    expect(onSave).toHaveBeenCalledWith({ ...one, characterIds: [] });
    expect(onSave).toHaveBeenCalledWith({ ...two, characterIds: [3, 1] });
    await userEvent.click(screen.getByRole('button', { name: 'Delete the cluster One' }));
    expect(onRemove).toHaveBeenCalledWith('c1');
  });
});
