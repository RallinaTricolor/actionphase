import { StrictMode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { makeBoard, makeCard, makeScene } from '@/test-utils/factories';
import type { Card } from '@/lib/gmBoard/types';
import { CardPanel } from './CardPanel';

// makeBoard's slots: k1 Pre-Scenario, k2 Slot 1, k3 Slot 2.
const names = new Map([
  [1, 'Harrison Vale'],
  [2, 'Mara'],
]);
const locations = [
  { id: 'mill', name: 'the Old Mill' },
  { id: 'dock', name: 'dock' },
];

function renderPanel(card: Card, others: Card[] = [], props: Partial<React.ComponentProps<typeof CardPanel>> = {}) {
  const handlers = { onChange: vi.fn(), onCreateLocation: vi.fn(() => 'new'), onSplit: vi.fn(() => true), onPushLater: vi.fn(), onDelete: vi.fn(), onClose: vi.fn() };
  const board = makeBoard({ cards: [card, ...others], scenes: [makeScene({ id: 'fight', title: 'Fight at the mill', chunkId: 'k2', locationId: 'mill' })] });
  render(<CardPanel card={card} board={board} names={names} locations={locations} {...handlers} {...props} />);
  return handlers;
}

describe('CardPanel', () => {
  it('edits the board’s copy of a quote, and suggests its first sentence as the label', async () => {
    const card = makeCard({ id: 'c', characterId: 1, locationId: 'mill', quote: 'I sneak into the mill at dusk. Then I wait.' });
    const { onChange } = renderPanel(card);
    expect(screen.getByLabelText(/Label on the board/)).toHaveAttribute('placeholder', 'I sneak into the mill at dusk.');
    const text = screen.getByLabelText('From the submission');
    await userEvent.type(text, '!');
    expect(onChange).toHaveBeenLastCalledWith({ quote: 'I sneak into the mill at dusk. Then I wait.!' });
  });

  it('gives a GM card an owner and a “What happens” box instead', () => {
    const card = makeCard({ id: 'c', characterId: 2, locationId: 'mill', gm: true, summary: 'Gets lost' });
    renderPanel(card, [], { cast: [{ id: 1, name: 'Harrison Vale', npc: false }, { id: 2, name: 'Mara', npc: false }] });
    expect(screen.getByLabelText('Whose card')).toHaveValue('2');
    expect(screen.getByLabelText('What happens')).toHaveValue('Gets lost');
    expect(screen.queryByLabelText(/Label on the board/)).not.toBeInTheDocument();
  });

  it('splits at the cursor, and says where to put it when the cursor is at an end', async () => {
    const card = makeCard({ id: 'c', characterId: 1, locationId: 'mill', quote: 'Plant the sword. Launch.' });
    const onSplit = vi.fn().mockReturnValueOnce(true).mockReturnValueOnce(false);
    renderPanel(card, [], { onSplit });
    const text = screen.getByLabelText('From the submission') as HTMLTextAreaElement;
    text.setSelectionRange(17, 17);
    await userEvent.click(screen.getByRole('button', { name: 'Split at the cursor' }));
    expect(onSplit).toHaveBeenLastCalledWith(17);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    text.setSelectionRange(0, 0);
    await userEvent.click(screen.getByRole('button', { name: 'Split at the cursor' }));
    expect(screen.getByRole('status')).toHaveTextContent('Put the cursor in the text');
  });

  it('sets an outcome, and asks “Because of…” for a failure with nearby cards and scenes', async () => {
    const card = makeCard({ id: 'c', characterId: 1, chunkId: 'k2', locationId: 'mill', summary: 'Grab the ledger' });
    const other = makeCard({ id: 'o', characterId: 2, chunkId: 'k2', locationId: 'mill', summary: 'Guard the ledger' });
    const { onChange } = renderPanel(card, [other]);
    expect(screen.queryByText(/Because of/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Unresolved' })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(screen.getByRole('button', { name: 'Failed' }));
    expect(onChange).toHaveBeenCalledWith({ outcome: 'failed' });
  });

  it('toggles causes from the same cell', async () => {
    const card = makeCard({ id: 'c', characterId: 1, chunkId: 'k2', locationId: 'mill', outcome: 'failed', causedBy: ['fight'] });
    const other = makeCard({ id: 'o', characterId: 2, chunkId: 'k2', locationId: 'mill', summary: 'Guard the ledger' });
    const { onChange } = renderPanel(card, [other]);
    expect(screen.getByText('Same place and time')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Scene: Fight at the mill' })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(screen.getByRole('button', { name: 'Mara: Guard the ledger' }));
    expect(onChange).toHaveBeenCalledWith({ causedBy: ['fight', 'o'] });
  });

  it('takes focus when it opens, and Esc gives it back to what opened it, under StrictMode too', async () => {
    const opener = document.createElement('button');
    document.body.appendChild(opener);
    opener.focus();
    const onClose = vi.fn();
    const card = makeCard({ id: 'c', characterId: 1, chunkId: 'k2', locationId: 'mill' });
    render(
      <StrictMode>
        <CardPanel card={card} board={makeBoard({ cards: [card] })} names={names} locations={locations} onChange={vi.fn()} onCreateLocation={vi.fn()} onSplit={vi.fn()} onPushLater={vi.fn()} onDelete={vi.fn()} onClose={onClose} />
      </StrictMode>,
    );
    expect(screen.getByTestId('card-panel')).toHaveFocus();
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(opener).toHaveFocus();
    opener.remove();
  });

  it('names an untitled scene by its cast, as the Map does', () => {
    const card = makeCard({ id: 'c', characterId: 1, chunkId: 'k2', locationId: 'mill', outcome: 'failed', causedBy: ['s2'] });
    const board = makeBoard({ cards: [card], scenes: [makeScene({ id: 's2', title: '', chunkId: 'k2', locationId: 'mill', participants: [1, 2] })] });
    render(<CardPanel card={card} board={board} names={names} locations={locations} onChange={vi.fn()} onCreateLocation={vi.fn()} onSplit={vi.fn()} onPushLater={vi.fn()} onDelete={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByRole('button', { name: /^Scene: Harrison, Mara/ })).toHaveAttribute('aria-pressed', 'true');
  });

  it('offers Push later only when the character has later cards', async () => {
    const card = makeCard({ id: 'c', characterId: 1, chunkId: 'k1', locationId: 'mill' });
    const { onPushLater } = renderPanel(card, [makeCard({ id: 'l', characterId: 1, chunkId: 'k3', locationId: 'mill' })]);
    expect(screen.getByText(/1 card after Pre-Scenario move one slot later/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Push Harrison’s later cards →' }));
    expect(onPushLater).toHaveBeenCalled();
  });

  it('disables Push later with nothing later', () => {
    renderPanel(makeCard({ id: 'c', characterId: 1, chunkId: 'k3', locationId: 'mill' }));
    expect(screen.getByRole('button', { name: /Push Harrison/ })).toBeDisabled();
  });

  it('asks for a location when the card’s is gone from the codex', () => {
    renderPanel(makeCard({ id: 'c', characterId: 1, locationId: 'deleted' }));
    expect(screen.getByText('No location: pick one.')).toBeInTheDocument();
  });

  it('offers Contingencies only to an IF card, and a waiting card has no outcome yet', () => {
    renderPanel(makeCard({ id: 'c', characterId: 1, locationId: 'mill' }));
    expect(screen.queryByRole('option', { name: /Contingencies/ })).not.toBeInTheDocument();
  });

  it('shows a waiting IF card as waiting, with no outcome', () => {
    renderPanel(makeCard({ id: 'c', characterId: 1, locationId: 'mill', isIF: true, chunkId: null }));
    expect(screen.getByRole('option', { name: /Contingencies/ })).toBeInTheDocument();
    expect(screen.getByText('Waiting in Contingencies')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Happened' })).not.toBeInTheDocument();
  });

  it('puts a waiting card back in a time slot when it stops being an IF card', async () => {
    const card = makeCard({ id: 'c', characterId: 1, locationId: 'mill', isIF: true, cond: 'if seen', chunkId: null });
    const { onChange } = renderPanel(card);
    await userEvent.click(screen.getByLabelText(/IF card/));
    expect(onChange).toHaveBeenCalledWith({ isIF: false, cond: '', branchOf: null, chunkId: 'k2' });
  });

  it('moves a card with the time slot picker', () => {
    const { onChange } = renderPanel(makeCard({ id: 'c', characterId: 1, locationId: 'mill', chunkId: 'k1' }));
    fireEvent.change(screen.getByLabelText('Time slot'), { target: { value: 'k3' } });
    expect(onChange).toHaveBeenCalledWith({ chunkId: 'k3' });
  });

  it('is read-only for a viewer', () => {
    renderPanel(makeCard({ id: 'c', characterId: 1, locationId: 'mill' }), [], { readOnly: true });
    expect(screen.queryByRole('button', { name: 'Delete card' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Split at the cursor' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Time slot')).toBeDisabled();
  });
});
