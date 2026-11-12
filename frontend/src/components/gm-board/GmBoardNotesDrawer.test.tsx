import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GmBoardNotesDrawer } from './GmBoardNotesDrawer';

const props = {
  open: true,
  onClose: vi.fn(),
  phaseTitle: 'Day 2',
  notes: '',
  gameNotes: '',
  onChange: vi.fn(),
  onGameChange: vi.fn(),
};

describe('GmBoardNotesDrawer', () => {
  it('reports every keystroke', async () => {
    const onChange = vi.fn();
    render(<GmBoardNotesDrawer {...props} onChange={onChange} />);
    await userEvent.type(screen.getByLabelText('Notes for Day 2'), 'abc');
    expect(onChange).toHaveBeenLastCalledWith('abc');
  });

  it('keeps notes for every phase apart from this phase’s', async () => {
    const onChange = vi.fn();
    const onGameChange = vi.fn();
    render(<GmBoardNotesDrawer {...props} notes="vault" gameNotes="the heist is a front" onChange={onChange} onGameChange={onGameChange} />);

    const game = screen.getByLabelText('Notes for every phase');
    expect(game).toHaveValue('the heist is a front');
    expect(screen.getByLabelText('Notes for Day 2')).toHaveValue('vault');

    await userEvent.type(game, '!');
    expect(onGameChange).toHaveBeenLastCalledWith('the heist is a front!');
    expect(onChange).not.toHaveBeenCalled();
  });

  // The saved notes arrive a tick after each keystroke; adopting them while
  // the GM types would drop characters.
  it('takes notes from elsewhere only while the box isn’t focused', async () => {
    const { rerender } = render(<GmBoardNotesDrawer {...props} notes="old" />);
    const box = screen.getByLabelText('Notes for Day 2');

    rerender(<GmBoardNotesDrawer {...props} notes="from the co-GM" />);
    expect(box).toHaveValue('from the co-GM');

    await userEvent.type(box, '!');
    rerender(<GmBoardNotesDrawer {...props} notes="stale" />);
    expect(box).toHaveValue('from the co-GM!');
  });

  it('shows both as text when read-only', () => {
    render(<GmBoardNotesDrawer {...props} notes="vault" gameNotes="" readOnly />);
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.getByTestId('gm-board-game-notes')).toHaveTextContent('No notes.');
    expect(screen.getByTestId('gm-board-notes')).toHaveTextContent('vault');
  });
});
