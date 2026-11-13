import { describe, it, expect, vi, afterEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BoardSidePanel } from './BoardSidePanel';

afterEach(() => window.localStorage.clear());

const panel = () => screen.getByTestId('board-side-panel');

describe('BoardSidePanel', () => {
  it('names itself for what it holds, and closes with ✕ or Escape from inside', async () => {
    const onClose = vi.fn();
    render(
      <BoardSidePanel tab="notes" onClose={onClose}>
        <input aria-label="inside" />
      </BoardSidePanel>,
    );
    expect(screen.getByRole('complementary', { name: 'Notes' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Close the notes' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    screen.getByLabelText('inside').focus();
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('resizes from its edge with the arrow keys, and remembers the width', () => {
    window.innerWidth = 1600;
    const { unmount } = render(<BoardSidePanel tab="codex" onClose={vi.fn()}>x</BoardSidePanel>);
    expect(panel()).toHaveStyle({ width: '560px' });
    const edge = screen.getByRole('separator', { name: 'Resize the panel' });
    fireEvent.keyDown(edge, { key: 'ArrowLeft' });
    fireEvent.keyDown(edge, { key: 'ArrowLeft' });
    expect(panel()).toHaveStyle({ width: '640px' });
    expect(edge).toHaveAttribute('aria-valuenow', '640');
    unmount();
    render(<BoardSidePanel tab="codex" onClose={vi.fn()}>x</BoardSidePanel>);
    expect(panel()).toHaveStyle({ width: '640px' });
  });

  it('never takes more than six tenths of the window, or less than its minimum', () => {
    window.innerWidth = 1000;
    window.localStorage.setItem('gmBoard.sidePanelWidth', '5000');
    render(<BoardSidePanel tab="codex" onClose={vi.fn()}>x</BoardSidePanel>);
    expect(panel()).toHaveStyle({ width: '600px' });
    const edge = screen.getByRole('separator', { name: 'Resize the panel' });
    for (let i = 0; i < 10; i++) fireEvent.keyDown(edge, { key: 'ArrowRight' });
    expect(panel()).toHaveStyle({ width: '360px' });
  });
});
