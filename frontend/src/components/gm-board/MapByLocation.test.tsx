import { describe, it, expect } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { makeCard, makeScene } from '@/test-utils/factories';
import { MapByLocation } from './MapByLocation';
import { CharacterStateTable } from './CharacterStateTable';
import { noDrag, testActions, testModel } from './mapTestModel';
import type { DragState } from './mapTypes';

const cell = (row: string, slot: string) => screen.getByTestId(`cell-${row}-${slot}`);

function renderGrid(model = testModel(), drag: DragState = noDrag()) {
  const actions = testActions();
  render(<MapByLocation model={model} actions={actions} drag={drag} />);
  return actions;
}

describe('MapByLocation', () => {
  it('shows this phase’s locations by time slot, plus another phase’s location a card still uses', () => {
    renderGrid(testModel({ cards: [makeCard({ id: 'a', characterId: 1, locationId: 'tower', chunkId: 'k2', summary: 'Climbs up' })] }));
    expect(screen.getByText('the Old Mill')).toBeInTheDocument();
    expect(screen.getByText('dock')).toBeInTheDocument();
    expect(screen.getByText('Set for another phase')).toBeInTheDocument();
    expect(within(cell('tower', 'k2')).getByRole('button', { name: /Harrison Vale: Climbs up/ })).toBeInTheDocument();
    expect(screen.getByLabelText('Name of time slot 2')).toHaveValue('Slot 1');
  });

  it('marks a busy cell with no scene, and lists the stances between the people there', async () => {
    const actions = renderGrid(
      testModel({
        cards: [
          makeCard({ id: 'a', characterId: 1, locationId: 'mill', chunkId: 'k2' }),
          makeCard({ id: 'b', characterId: 2, locationId: 'mill', chunkId: 'k2' }),
        ],
        stances: { '1|2': { value: 'target', note: 'owes him' }, '2|1': { value: 'ally' } },
      }),
    );
    const pill = within(cell('mill', 'k2')).getByText('Busy · no scene');
    const title = pill.parentElement?.getAttribute('title') ?? '';
    expect(title).toContain('Here: Harrison, Mara');
    expect(title).toContain('Harrison → Mara: Target — owes him (they think it’s an alliance)');
    expect(title).toContain('Mara → Harrison: Ally');
    await userEvent.click(within(cell('mill', 'k2')).getByRole('button', { name: 'Create scene at the Old Mill, Slot 1' }));
    expect(actions.createScene).toHaveBeenCalledWith('mill', 'k2');
  });

  it('shows one Scene or Conflict pill for a cell with a scene, opening it in Scenes', async () => {
    const actions = renderGrid(
      testModel({
        scenes: [
          makeScene({ id: 's1', title: 'Talk', locationId: 'mill', chunkId: 'k2', participants: [1, 2] }),
          makeScene({ id: 's2', title: 'Fight', locationId: 'dock', chunkId: 'k3', participants: [1, 3], conflict: true }),
        ],
      }),
    );
    expect(within(cell('mill', 'k2')).getByText('Scene')).toBeInTheDocument();
    expect(within(cell('dock', 'k3')).getByText('Conflict')).toBeInTheDocument();
    expect(within(cell('dock', 'k3')).queryByRole('button', { name: /^Create scene/ })).not.toBeInTheDocument();
    await userEvent.click(within(cell('dock', 'k3')).getByRole('button', { name: 'Open the conflict here' }));
    expect(actions.openScene).toHaveBeenLastCalledWith('s2');
    await userEvent.click(within(cell('mill', 'k2')).getByRole('button', { name: '▸ Talk' }));
    expect(actions.openScene).toHaveBeenLastCalledWith('s1');
  });

  it('folds moot cards behind “+N moot”', async () => {
    renderGrid(testModel({ cards: [makeCard({ id: 'm', characterId: 1, locationId: 'dock', chunkId: 'k1', outcome: 'moot', summary: 'Waits' })] }));
    expect(screen.queryByRole('button', { name: /Waits/ })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '+1 moot' }));
    expect(screen.getByRole('button', { name: /Harrison Vale: Waits/ })).toBeInTheDocument();
  });

  it('with a cluster picked, shows only rows its people (or NPCs) use', () => {
    renderGrid(
      testModel(
        {
          cards: [
            makeCard({ id: 'a', characterId: 1, locationId: 'mill', chunkId: 'k2' }),
            makeCard({ id: 'b', characterId: 2, locationId: 'dock', chunkId: 'k2' }),
          ],
        },
        { visible: [2] },
      ),
    );
    expect(screen.queryByText('the Old Mill')).not.toBeInTheDocument();
    expect(screen.getByText('dock')).toBeInTheDocument();
  });

  it('adds GM cards at a cell, inserts a slot before another, and removes only an empty slot', async () => {
    const actions = renderGrid(testModel({ cards: [makeCard({ id: 'a', characterId: 1, locationId: 'mill', chunkId: 'k2' })] }));
    await userEvent.click(screen.getByRole('button', { name: 'Add GM cards at dock, Slot 2' }));
    expect(actions.addGmCards).toHaveBeenCalledWith({ locationId: 'dock', chunkId: 'k3' });
    await userEvent.click(screen.getByRole('button', { name: 'Insert a time slot before Slot 1' }));
    expect(actions.insertSlotBefore).toHaveBeenCalledWith(1);
    expect(screen.queryByRole('button', { name: 'Remove the empty slot Slot 1' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Remove the empty slot Slot 2' }));
    expect(actions.removeSlot).toHaveBeenCalledWith('k3');
  });

  it('counts what’s left to do in each slot', async () => {
    const actions = renderGrid(testModel({ cards: [makeCard({ id: 'a', characterId: 1, locationId: 'mill', chunkId: 'k2', outcome: 'pending' })] }));
    await userEvent.click(within(screen.getByTestId('slot-head-k2')).getByText('1 to do'));
    expect(actions.resolveAt).toHaveBeenCalledWith('k2');
  });

  it('lists waiting IF cards in Contingencies and moves a dropped card to its cell', () => {
    const drag = noDrag('w');
    const model = testModel({ cards: [makeCard({ id: 'w', characterId: 3, locationId: 'dock', chunkId: null, isIF: true, cond: 'the dogs bark', summary: 'Runs' })] });
    const actions = renderGrid(model, drag);
    expect(within(screen.getByTestId('contingencies')).getByRole('button', { name: /Ilse: Runs/ })).toBeInTheDocument();
    fireEvent.dragOver(cell('mill', 'k2'), { dataTransfer: { dropEffect: '' } });
    fireEvent.drop(cell('mill', 'k2'), { dataTransfer: { getData: () => 'w' } });
    expect(drag.end).toHaveBeenCalled();
    expect(actions.moveCard).toHaveBeenCalledWith(model.board.cards[0], { chunkId: 'k2', locationId: 'mill' });
  });

  it('dims the other slots while resolving one', () => {
    renderGrid(testModel({}, { resolving: 'k2' }));
    expect(cell('mill', 'k1').className).toContain('opacity-40');
    expect(cell('mill', 'k2').className).not.toContain('opacity-40');
  });
});

describe('CharacterStateTable', () => {
  it('shows each player’s state per slot, starting open', async () => {
    render(
      <CharacterStateTable
        model={testModel({ scenes: [makeScene({ id: 's', chunkId: 'k2', participants: [1], effects: [{ characterId: 1, state: 'injured' }] })] })}
      />,
    );
    const row = screen.getByRole('rowheader', { name: 'Harrison Vale' }).closest('tr') as HTMLElement;
    expect(within(row).getAllByRole('cell').map((c) => c.textContent)).toEqual(['Active', 'Injured', 'Injured']);
    expect(screen.queryByRole('rowheader', { name: 'Bo Hale' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Character state over the phase/ }));
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});
