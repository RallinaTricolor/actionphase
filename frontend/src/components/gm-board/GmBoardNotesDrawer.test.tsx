import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GmBoardNotesDrawer } from './GmBoardNotesDrawer';

describe('GmBoardNotesDrawer', () => {
  it('reports every keystroke', async () => {
    const onChange = vi.fn();
    render(<GmBoardNotesDrawer open onClose={vi.fn()} notes="" onChange={onChange} />);
    await userEvent.type(screen.getByLabelText('Notes for this phase'), 'abc');
    expect(onChange).toHaveBeenLastCalledWith('abc');
  });

  // The saved notes arrive a tick after each keystroke; adopting them while
  // the GM types would drop characters.
  it('takes notes from elsewhere only while the box isn’t focused', async () => {
    const { rerender } = render(<GmBoardNotesDrawer open onClose={vi.fn()} notes="old" onChange={vi.fn()} />);
    const box = screen.getByLabelText('Notes for this phase');

    rerender(<GmBoardNotesDrawer open onClose={vi.fn()} notes="from the co-GM" onChange={vi.fn()} />);
    expect(box).toHaveValue('from the co-GM');

    await userEvent.type(box, '!');
    rerender(<GmBoardNotesDrawer open onClose={vi.fn()} notes="stale" onChange={vi.fn()} />);
    expect(box).toHaveValue('from the co-GM!');
  });
});
