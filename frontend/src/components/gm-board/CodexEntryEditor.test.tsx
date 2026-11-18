import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { makeCodexEntry } from '@/test-utils/factories';
import { CodexEntryEditor } from './CodexEntryEditor';

const phases = [
  { id: 70, title: 'Day 1' },
  { id: 71, title: 'Day 2' },
];
const players = [{ id: 2, name: 'Mara' }];

describe('CodexEntryEditor', () => {
  it('saves other names as a list', async () => {
    const onChange = vi.fn();
    render(<CodexEntryEditor entry={makeCodexEntry({ id: 'e', name: 'Mill' })} phases={phases} players={players} onChange={onChange} onDelete={vi.fn()} />);
    await userEvent.type(screen.getByLabelText('Other names'), 'wheel, ');
    expect(onChange).toHaveBeenLastCalledWith({ aliases: ['wheel'] });
    expect(screen.getByLabelText('Other names')).toHaveValue('wheel, ');
  });

  it('won’t save an empty name', async () => {
    const onChange = vi.fn();
    render(<CodexEntryEditor entry={makeCodexEntry({ id: 'e', name: 'M' })} phases={phases} players={players} onChange={onChange} onDelete={vi.fn()} />);
    await userEvent.clear(screen.getByLabelText('Name'));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByText('An entry needs a name.')).toBeInTheDocument();
  });

  it('goes back to every phase', async () => {
    const onChange = vi.fn();
    render(
      <CodexEntryEditor entry={makeCodexEntry({ id: 'e', name: 'Mill', phases: [70] })} phases={phases} players={players} onChange={onChange} onDelete={vi.fn()} />,
    );
    await userEvent.click(screen.getByLabelText('Every phase'));
    expect(onChange).toHaveBeenCalledWith({ phases: [] });
    await userEvent.click(screen.getByLabelText('Day 1'));
    expect(onChange).toHaveBeenLastCalledWith({ phases: [] });
  });

  it('asks who may know a secret only once it is one', () => {
    const { rerender } = render(
      <CodexEntryEditor entry={makeCodexEntry({ id: 'e', name: 'Mill' })} phases={phases} players={players} onChange={vi.fn()} onDelete={vi.fn()} />,
    );
    expect(screen.queryByText('Allowed to know')).not.toBeInTheDocument();
    rerender(
      <CodexEntryEditor entry={makeCodexEntry({ id: 'e', name: 'Mill', secret: true })} phases={phases} players={players} onChange={vi.fn()} onDelete={vi.fn()} />,
    );
    expect(screen.getByText('Allowed to know')).toBeInTheDocument();
  });
});
