import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { makeMoment } from '@/test-utils/factories';
import { SceneSideBySide } from './SceneSideBySide';
import { sceneModel } from './sceneTestModel';

describe('SceneSideBySide', () => {
  const model = sceneModel({
    participants: [1, 2],
    moments: [
      makeMoment({ id: 'm1', text: 'Harrison draws.', readers: [1, 2], ownText: { 2: 'A gun, aimed at you.' } }),
      makeMoment({ id: 'm2', text: 'Mara runs.', readers: [2] }),
    ],
  });

  it('shows each reader’s version of each moment, and why someone misses one', () => {
    render(<SceneSideBySide model={model} onPick={vi.fn()} />);
    expect(screen.getByTestId('side-m1-1')).toHaveTextContent('You draw.');
    expect(screen.getByTestId('side-m1-2')).toHaveTextContent('A gun, aimed at you.');
    expect(screen.getByTestId('side-m2-1')).toHaveTextContent('Not ticked on this moment');
    expect(screen.getByTestId('side-m2-2')).toHaveTextContent('You run.');
  });

  it('labels a moment with no shared text by what it has', () => {
    const empty = sceneModel({
      participants: [1, 2],
      moments: [makeMoment({ id: 'a', readers: [1] }), makeMoment({ id: 'b', readers: [1], ownText: { 1: 'You wait.' } })],
    });
    render(<SceneSideBySide model={empty} onPick={vi.fn()} />);
    expect(screen.getByText('nothing written yet')).toBeInTheDocument();
    expect(screen.getByText('only own versions')).toBeInTheDocument();
  });

  it('opens a moment for editing from a cell', async () => {
    const onPick = vi.fn();
    render(<SceneSideBySide model={model} onPick={onPick} />);
    await userEvent.click(screen.getByTestId('side-m2-1'));
    expect(onPick).toHaveBeenCalledWith('m2', 1);
  });

  it('asks for players first', () => {
    render(<SceneSideBySide model={sceneModel({ participants: [9] })} onPick={vi.fn()} />);
    expect(screen.getByText('Add players to the scene to compare their versions.')).toBeInTheDocument();
  });
});
