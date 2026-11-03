import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { makeScene } from '@/test-utils/factories';
import { SceneHeader } from './SceneHeader';
import { sceneModel } from './sceneTestModel';

const others = [
  makeScene({ id: 'early', locationId: 'dock', chunkId: 'k1', participants: [3], title: 'Harbour' }),
  makeScene({ id: 'late', locationId: 'dock', chunkId: 'k3', participants: [4] }),
];
const locations = [
  { id: 'mill', name: 'the Old Mill', aliases: [], kind: 'phase' as const },
  { id: 'dock', name: 'dock', aliases: [], kind: 'phase' as const },
];

function setup() {
  const model = sceneModel({ participants: [1, 2] }, { scenes: others });
  const props = { onGo: vi.fn(), onChange: vi.fn(), onDelete: vi.fn() };
  render(
    <SceneHeader
      model={model}
      slots={model.board.chunks}
      locations={locations}
      placeName={(id) => locations.find((l) => l.id === id)?.name ?? 'No location'}
      {...props}
    />,
  );
  return props;
}

describe('SceneHeader', () => {
  it('groups every scene by time slot in the picker', () => {
    setup();
    const picker = screen.getByLabelText('Go to a scene');
    const groups = within(picker).getAllByRole('group');
    expect(groups.map((g) => g.getAttribute('label'))).toEqual(['Pre-Scenario', 'Slot 1', 'Slot 2']);
    expect(within(picker).getAllByRole('option').map((o) => o.textContent)).toEqual(['dock · Harbour', 'the Old Mill · Harrison, Mara', 'dock · Tov']);
  });

  it('walks to the previous and next scene in time order', async () => {
    const h = setup();
    expect(screen.getByText('Scene 2 of 3')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '← Previous' }));
    expect(h.onGo).toHaveBeenLastCalledWith('early');
    await userEvent.click(screen.getByRole('button', { name: 'Next →' }));
    expect(h.onGo).toHaveBeenLastCalledWith('late');
  });

  it('edits the title, place, time and Conflict tick; the title defaults to the cast', async () => {
    const h = setup();
    const title = screen.getByLabelText('Scene title');
    expect(title).toHaveAttribute('placeholder', 'Harrison, Mara');
    fireEvent.change(title, { target: { value: 'The standoff' } });
    expect(h.onChange).toHaveBeenLastCalledWith({ title: 'The standoff' });
    await userEvent.selectOptions(screen.getByLabelText('Location'), 'dock');
    expect(h.onChange).toHaveBeenLastCalledWith({ locationId: 'dock' });
    await userEvent.selectOptions(screen.getByLabelText('Time slot'), 'k3');
    expect(h.onChange).toHaveBeenLastCalledWith({ chunkId: 'k3' });
    await userEvent.click(screen.getByLabelText('Conflict'));
    expect(h.onChange).toHaveBeenLastCalledWith({ conflict: true });
  });
});
