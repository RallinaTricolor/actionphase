import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { DirtyEdit } from '@/lib/gmBoard/store';
import { GmBoardConflicts } from './GmBoardConflicts';

const edit = (kind: string, key: string, deleted = false): DirtyEdit => ({ kind, key, baseVersion: 1, doc: {}, deleted, rev: 1 });

describe('GmBoardConflicts', () => {
  it('names each lost edit and puts the chosen one back', async () => {
    const onKeepMine = vi.fn();
    const lost = [edit('notes', 'notes'), edit('card', 'c1', true)];
    render(<GmBoardConflicts lost={lost} onKeepMine={onKeepMine} onDismiss={vi.fn()} />);

    expect(screen.getByText('the notes')).toBeInTheDocument();
    expect(screen.getByText('a card (you deleted it)')).toBeInTheDocument();

    await userEvent.click(screen.getAllByRole('button', { name: 'Use mine' })[1]);
    expect(onKeepMine).toHaveBeenCalledWith(lost[1]);
  });

  it('shows nothing when nothing was lost', () => {
    const { container } = render(<GmBoardConflicts lost={[]} onKeepMine={vi.fn()} onDismiss={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });
});
