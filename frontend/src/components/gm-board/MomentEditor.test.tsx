import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { makeCard, makeMoment } from '@/test-utils/factories';
import type { Moment } from '@/lib/gmBoard/types';
import { MomentEditor } from './MomentEditor';
import { sceneModel } from './sceneTestModel';
import type { MomentActions } from './sceneTypes';

function setup(moment: Moment, participants = [1, 2, 9], extra: Partial<Parameters<typeof sceneModel>[1]> = {}) {
  const model = sceneModel({ participants, moments: [moment, makeMoment({ id: 'other', readers: [1] })] }, extra);
  let current = moment;
  const actions: MomentActions = {
    change: vi.fn((_id, fn) => {
      current = fn(current);
    }),
    addAfter: vi.fn(),
    move: vi.fn(),
    remove: vi.fn(),
    focus: vi.fn(),
    field: vi.fn(),
  };
  render(<MomentEditor moment={moment} index={0} model={model} actions={actions} focused={false} />);
  return { actions, after: () => current };
}

describe('MomentEditor', () => {
  it('ticks and unticks readers; NPCs nobody plays get no chip', async () => {
    const { actions, after } = setup(makeMoment({ id: 'm', text: 'Harrison draws.', readers: [1, 2] }));
    const chips = screen.getByRole('group', { name: 'Who reads moment 1' });
    expect(within(chips).queryByRole('button', { name: 'Bo' })).not.toBeInTheDocument();
    await userEvent.click(within(chips).getByRole('button', { name: 'Mara' }));
    expect(actions.change).toHaveBeenCalled();
    expect(after().readers).toEqual([1]);
  });

  it('says who reads it when not everyone does, and labels a GM note', () => {
    setup(makeMoment({ id: 'm', text: 'Harrison draws.', readers: [1] }));
    expect(screen.getByText('Only Harrison reads this.')).toBeInTheDocument();
  });

  it('is a GM note with nobody ticked', () => {
    setup(makeMoment({ id: 'm', text: 'Bo was paid.', readers: [] }));
    expect(screen.getByLabelText('GM note: nobody is ticked, so only you see this')).toHaveValue('Bo was paid.');
  });

  it('starts an own version from the reader’s current text, and drops it again', async () => {
    const { after } = setup(makeMoment({ id: 'm', text: 'Mara ducks.', readers: [1, 2] }));
    await userEvent.click(screen.getByRole('button', { name: 'Own version for Mara' }));
    expect(after().ownText).toEqual({ 2: 'You duck.' });
  });

  it('edits an own version, and goes back to the shared text', async () => {
    const { after } = setup(makeMoment({ id: 'm', text: 'Mara ducks.', readers: [1, 2], ownText: { 2: 'You duck.' } }));
    const own = screen.getByLabelText('Mara reads instead');
    fireEvent.change(own, { target: { value: 'You duck fast.' } });
    expect(after().ownText[2]).toBe('You duck fast.');
    await userEvent.click(screen.getByRole('button', { name: 'Remove Mara’s own version' }));
    expect(after().ownText).toEqual({});
  });

  it('adds someone elsewhere as a reader', async () => {
    const { after } = setup(makeMoment({ id: 'm', text: 'A shot rings out.', readers: [1, 2] }));
    await userEvent.selectOptions(screen.getByLabelText('Also tell someone elsewhere'), 'Ilse');
    expect(after().readers).toEqual([1, 2, 3]);
  });

  it('adds a moment below on Ctrl+Enter, and reports the cursor for Insert', () => {
    const { actions } = setup(makeMoment({ id: 'm', text: 'Harrison draws.', readers: [1, 2] }));
    const box = screen.getByLabelText('What happens, with names') as HTMLTextAreaElement;
    box.setSelectionRange(4, 4);
    fireEvent.select(box);
    expect(actions.field).toHaveBeenLastCalledWith({ momentId: 'm', readerId: null, start: 4, end: 4 });
    fireEvent.keyDown(box, { key: 'Enter', ctrlKey: true });
    expect(actions.addAfter).toHaveBeenCalledWith('m');
  });

  it('moves and deletes, with the first moment unable to move up', async () => {
    const { actions } = setup(makeMoment({ id: 'm', readers: [1] }));
    expect(screen.getByRole('button', { name: 'Move moment 1 up' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Move moment 1 down' }));
    expect(actions.move).toHaveBeenCalledWith('m', 1);
    await userEvent.click(screen.getByRole('button', { name: 'Delete moment 1' }));
    expect(actions.remove).toHaveBeenCalledWith('m');
  });

  it('shows the plan card it came from', () => {
    setup(makeMoment({ id: 'm', readers: [1], cardId: 'c' }), [1], {
      cards: [makeCard({ id: 'c', characterId: 1, summary: 'Draws on Mara', quote: 'I draw on her.', outcome: 'happened' })],
    });
    expect(screen.getByText(/From Harrison’s plan:/)).toHaveTextContent('Draws on Mara');
    expect(screen.getByText('“I draw on her.”')).toBeInTheDocument();
  });
});
