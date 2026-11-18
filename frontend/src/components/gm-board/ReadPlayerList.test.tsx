import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReadPlayerList } from './ReadPlayerList';

const players = [
  { id: 1, name: 'Harrison Vale', cards: 3, readDone: true },
  { id: 2, name: 'Mara', cards: 0, readDone: false },
];

describe('ReadPlayerList', () => {
  it('counts who is read and marks the open submission', () => {
    render(<ReadPlayerList players={players} selectedId={2} onSelect={vi.fn()} />);
    expect(screen.getByText('1/2 read')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Mara/ })).toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('button', { name: /Harrison Vale/ })).toHaveTextContent('✓3');
  });

  it('opens a submission', async () => {
    const onSelect = vi.fn();
    render(<ReadPlayerList players={players} selectedId={2} onSelect={onSelect} />);
    await userEvent.click(screen.getByRole('button', { name: /Harrison Vale/ }));
    expect(onSelect).toHaveBeenCalledWith(1);
  });
});
