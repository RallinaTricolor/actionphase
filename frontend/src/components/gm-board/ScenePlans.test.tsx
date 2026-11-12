import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { makeCard, makeCodexEntry, makeMoment } from '@/test-utils/factories';
import { ScenePlans } from './ScenePlans';
import { sceneModel } from './sceneTestModel';

const cards = [
  makeCard({ id: 'draw', characterId: 1, locationId: 'mill', chunkId: 'k2', summary: 'Draws on Mara', quote: 'I draw on her.' }),
  makeCard({ id: 'wait', characterId: 1, chunkId: null, isIF: true, cond: 'the bell rings', summary: 'Runs for the door' }),
  makeCard({ id: 'later', characterId: 1, locationId: 'dock', chunkId: 'k3', summary: 'Sails' }),
  makeCard({ id: 'ilse', characterId: 3, locationId: 'mill', chunkId: 'k2', summary: 'Watches' }),
];

function setup(moments = [makeMoment({ id: 'm', readers: [1, 2] })], readOnly = false) {
  const model = {
    ...sceneModel({ participants: [1, 2, 9], moments }, { cards, stances: { '1|2': { value: 'target', note: 'owes him' } } }),
    readOnly,
  };
  const props = { onSetOutcome: vi.fn(), onTrigger: vi.fn(), onMomentFromCard: vi.fn(), onJoin: vi.fn(), onOpenCard: vi.fn() };
  render(
    <ScenePlans
      model={model}
      location={makeCodexEntry({ id: 'mill', name: 'the Old Mill', type: 'Location', notes: 'The wheel is loud.' })}
      placeName={(id) => ({ mill: 'the Old Mill', dock: 'dock' })[id] ?? 'No location'}
      slotName={(id) => model.board.chunks.find((c) => c.id === id)?.name ?? 'Contingencies'}
      {...props}
    />,
  );
  return props;
}

describe('ScenePlans', () => {
  it('shows each person’s stances, cards here, waiting IF cards and other times', () => {
    setup();
    const harrison = screen.getByTestId('plans-1');
    expect(within(harrison).getByText('→ Mara')).toBeInTheDocument();
    expect(within(harrison).getByText('Target')).toBeInTheDocument();
    expect(within(harrison).getByText('owes him')).toBeInTheDocument();
    expect(within(screen.getByTestId('plan-draw')).getByText('Draws on Mara')).toBeInTheDocument();
    expect(within(screen.getByTestId('plan-wait')).getByText('If the bell rings:')).toBeInTheDocument();
    expect(within(harrison).getByText('Other times (1)')).toBeInTheDocument();
    expect(screen.getByText('The wheel is loud.')).toBeInTheDocument();
    expect(screen.getByTestId('plans-2')).toHaveTextContent('No cards in Slot 1.');
    expect(screen.queryByTestId('plans-9')).not.toBeInTheDocument();
  });

  it('sets an outcome inline, triggers a waiting IF card, and starts a moment from a card', async () => {
    const h = setup();
    await userEvent.selectOptions(screen.getByLabelText('Outcome: Draws on Mara'), 'Happened');
    expect(h.onSetOutcome).toHaveBeenCalledWith(expect.objectContaining({ id: 'draw' }), 'happened');
    await userEvent.click(within(screen.getByTestId('plan-wait')).getByRole('button', { name: 'Triggers here' }));
    expect(h.onTrigger).toHaveBeenCalledWith(expect.objectContaining({ id: 'wait' }));
    await userEvent.click(within(screen.getByTestId('plan-draw')).getByRole('button', { name: '→ Moment' }));
    expect(h.onMomentFromCard).toHaveBeenCalledWith(expect.objectContaining({ id: 'draw' }));
  });

  it('offers another moment from a card already used', () => {
    setup([makeMoment({ id: 'm', readers: [1], cardId: 'draw' })]);
    expect(within(screen.getByTestId('plan-draw')).getByRole('button', { name: '+ Another moment' })).toBeInTheDocument();
  });

  it('offers to add someone else at this place and time', async () => {
    const h = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Add Ilse to the scene' }));
    expect(h.onJoin).toHaveBeenCalledWith(3);
  });

  // The note, the causes, the text and the place are in the card panel; it opens beside the moments.
  it('opens any card in the card panel, read-only too', async () => {
    const h = setup();
    await userEvent.click(within(screen.getByTestId('plan-draw')).getByRole('button', { name: 'Open the card: Draws on Mara' }));
    expect(h.onOpenCard).toHaveBeenCalledWith('draw');
  });

  it('lets a viewer open a card to read it', async () => {
    const h = setup(undefined, true);
    await userEvent.click(within(screen.getByTestId('plan-wait')).getByRole('button', { name: 'Open the card: Runs for the door' }));
    expect(h.onOpenCard).toHaveBeenCalledWith('wait');
  });
});
