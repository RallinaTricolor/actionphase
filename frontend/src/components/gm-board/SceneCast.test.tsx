import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { makeScene } from '@/test-utils/factories';
import type { Scene } from '@/lib/gmBoard/types';
import { SceneCast } from './SceneCast';
import { sceneModel } from './sceneTestModel';

function setup(scene: Partial<Scene> = {}, board = {}) {
  const model = sceneModel({ participants: [1, 9], ...scene }, board);
  let current = model.scene;
  const props = {
    onJoin: vi.fn(),
    onLeave: vi.fn(),
    onEffects: vi.fn((fn: (s: Scene) => Scene) => {
      current = fn(current);
    }),
    onRemoveEffect: vi.fn(),
  };
  render(<SceneCast model={model} {...props} />);
  return { ...props, after: () => current };
}

describe('SceneCast', () => {
  it('lists the cast, NPCs marked, and adds or removes people', async () => {
    const h = setup();
    expect(screen.getByText('NPC')).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('Add someone to the scene'), 'Ilse');
    expect(h.onJoin).toHaveBeenCalledWith(3);
    await userEvent.click(screen.getByRole('button', { name: 'Remove Harrison Vale from the scene' }));
    expect(h.onLeave).toHaveBeenCalledWith(1);
  });

  it('shows someone’s state in this time slot', () => {
    setup({}, { scenes: [makeScene({ id: 'before', chunkId: 'k1', participants: [1], effects: [{ characterId: 1, state: 'injured' as const }] })] });
    expect(screen.getByText('Injured')).toBeInTheDocument();
  });

  it('adds a state effect that lasts until a later slot or the end of the phase', async () => {
    const h = setup({ effects: [{ characterId: 1, state: 'injured' }] });
    await userEvent.selectOptions(screen.getByLabelText('Effect 1: state'), 'Captured');
    expect(h.after().effects).toEqual([{ characterId: 1, state: 'captured' }]);
    const until = screen.getByLabelText('Effect 1: until');
    expect([...(until as HTMLSelectElement).options].map((o) => o.text)).toEqual(['until the end of the phase', 'back by Slot 2']);
    await userEvent.selectOptions(until, 'back by Slot 2');
    expect(h.after().effects[0]).toEqual({ characterId: 1, state: 'captured', untilChunkId: 'k3' });
    await userEvent.click(screen.getByRole('button', { name: 'Remove effect 1' }));
    expect(h.onRemoveEffect).toHaveBeenCalledWith(0);
  });

  it('adds an effect for the first person in the scene', async () => {
    const h = setup();
    await userEvent.click(screen.getByRole('button', { name: '+ State' }));
    expect(h.after().effects).toEqual([{ characterId: 1, state: 'injured' }]);
  });
});
