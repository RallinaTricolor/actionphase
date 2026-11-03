import { describe, it, expect } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { makeCard, makeScene } from '@/test-utils/factories';
import { MapByCharacter } from './MapByCharacter';
import { noDrag, testActions, testModel } from './mapTestModel';
import type { DragState } from './mapTypes';

function renderRows(model = testModel(), drag: DragState = noDrag()) {
  const actions = testActions();
  render(<MapByCharacter model={model} actions={actions} drag={drag} />);
  return actions;
}

describe('MapByCharacter', () => {
  it('groups players by cluster, with Read and Stances on each row', async () => {
    const actions = renderRows(testModel({ clusters: [{ id: 'cl', name: 'Mill crew', characterIds: [2] }] }, { submitters: [2] }));
    expect(screen.getByText('Mill crew')).toBeInTheDocument();
    expect(screen.getByText('Not in a cluster')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Read Mara Quill’s submission' }));
    expect(actions.readSubmission).toHaveBeenCalledWith(2);
    expect(screen.queryByRole('button', { name: 'Read Ilse’s submission' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Ilse’s stances' }));
    expect(actions.openStances).toHaveBeenCalledWith(3);
  });

  it('hatches slots where someone is out of play, and marks where their state changes', () => {
    renderRows(
      testModel({
        scenes: [makeScene({ id: 's', locationId: 'mill', chunkId: 'k1', participants: [1], effects: [{ characterId: 1, state: 'captured' }] })],
      }),
    );
    const k1 = screen.getByTestId('char-cell-1-k1');
    const k2 = screen.getByTestId('char-cell-1-k2');
    expect(within(k1).getByText('Captured')).toBeInTheDocument();
    expect(k1.className).not.toContain('gm-out-of-play');
    expect(k2.className).toContain('gm-out-of-play');
    expect(k2).toHaveAttribute('title', 'Harrison Vale is captured here');
    expect(within(k2).queryByText('Captured')).not.toBeInTheDocument();
  });

  it('lists each character’s scenes in their slot, opening one in Scenes', async () => {
    const actions = renderRows(testModel({ scenes: [makeScene({ id: 's1', title: 'Standoff', locationId: 'mill', chunkId: 'k2', participants: [1, 2], conflict: true })] }));
    const harrison = screen.getByTestId('char-cell-1-k2');
    expect(within(screen.getByTestId('char-cell-2-k2')).getByText(/the Old Mill: Standoff/)).toBeInTheDocument();
    expect(within(screen.getByTestId('char-cell-3-k2')).queryByText(/Standoff/)).not.toBeInTheDocument();
    await userEvent.click(within(harrison).getByRole('button', { name: /Standoff/ }));
    expect(actions.openScene).toHaveBeenCalledWith('s1');
  });

  it('starts a GM card where the character last was', async () => {
    const actions = renderRows(testModel({ cards: [makeCard({ id: 'a', characterId: 3, locationId: 'dock', chunkId: 'k1' })] }));
    expect(within(screen.getByTestId('char-cell-3-k1')).getByText('dock')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Add a GM card for Ilse in Slot 2' }));
    expect(actions.addGmCards).toHaveBeenCalledWith({ characterIds: [3], chunkId: 'k3', locationId: 'dock' });
  });

  it('drops a card along its own row (the cell names the character)', () => {
    const model = testModel({ cards: [makeCard({ id: 'a', characterId: 3, locationId: 'dock', chunkId: 'k1' })] });
    const actions = renderRows(model, noDrag('a'));
    fireEvent.drop(screen.getByTestId('char-cell-1-k2'), { dataTransfer: { getData: () => 'a' } });
    expect(actions.moveCard).toHaveBeenCalledWith(model.board.cards[0], { chunkId: 'k2', characterId: 1 });
  });
});
