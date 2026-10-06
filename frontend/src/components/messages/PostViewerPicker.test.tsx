import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PostViewerPicker } from './PostViewerPicker';
import type { PickablePlayer } from '@/lib/postViewers';

const players: PickablePlayer[] = [
  { userId: 10, username: 'amy', characterNames: ['Brynn'] },
  { userId: 11, username: 'zed', characterNames: [] },
];

// Holds the state the way the forms do, and reports each change.
function Harness({
  initialRestricted = false,
  initialSelected = [],
  pickable = players,
  onChange = () => {},
}: {
  initialRestricted?: boolean;
  initialSelected?: number[];
  pickable?: PickablePlayer[];
  onChange?: (ids: number[]) => void;
}) {
  const [restricted, setRestricted] = useState(initialRestricted);
  const [selected, setSelected] = useState(initialSelected);
  return (
    <PostViewerPicker
      players={pickable}
      restricted={restricted}
      onRestrictedChange={setRestricted}
      selectedUserIds={selected}
      onSelectedChange={(ids) => {
        setSelected(ids);
        onChange(ids);
      }}
    />
  );
}

describe('PostViewerPicker', () => {
  it('hides the player list until the toggle is on', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    expect(screen.queryByTestId('post-viewer-10')).not.toBeInTheDocument();
    await user.click(screen.getByTestId('restrict-post-toggle'));
    expect(screen.getByTestId('post-viewer-10')).toBeInTheDocument();
    expect(screen.getByTestId('post-viewer-11')).toBeInTheDocument();
  });

  it('labels players by character, with the username underneath', () => {
    render(<Harness initialRestricted />);
    expect(screen.getByLabelText('Brynn')).toBeInTheDocument();
    expect(screen.getByText('@amy')).toBeInTheDocument();
    // No character: the username is the label.
    expect(screen.getByLabelText('zed')).toBeInTheDocument();
  });

  it('adds and removes players', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness initialRestricted onChange={onChange} />);

    await user.click(screen.getByLabelText('Brynn'));
    expect(onChange).toHaveBeenLastCalledWith([10]);
    await user.click(screen.getByLabelText('zed'));
    expect(onChange).toHaveBeenLastCalledWith([10, 11]);
    await user.click(screen.getByLabelText('Brynn'));
    expect(onChange).toHaveBeenLastCalledWith([11]);
  });

  it('asks for at least one player while none is ticked', async () => {
    const user = userEvent.setup();
    render(<Harness initialRestricted />);

    expect(screen.getByText(/pick at least one player/i)).toBeInTheDocument();
    await user.click(screen.getByLabelText('Brynn'));
    expect(screen.queryByText(/pick at least one player/i)).not.toBeInTheDocument();
  });

  it('says so when there is nobody to pick', () => {
    render(<Harness initialRestricted pickable={[]} />);
    expect(screen.getByText(/no active players/i)).toBeInTheDocument();
  });
});
