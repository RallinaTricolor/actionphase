import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { BoardDoc } from '@/lib/gmBoard/types';
import { StanceMatrix } from './StanceMatrix';
import { CAST } from './mapTestModel';

const players = CAST.filter((c) => !c.npc);
const names = new Map(CAST.map((c) => [c.id, c.name]));

function renderMatrix(stances: BoardDoc['stances'] = {}, focusId: number | null = null) {
  const onSet = vi.fn();
  const onSetMany = vi.fn();
  render(<StanceMatrix stances={stances} players={players} names={names} focusId={focusId} onSet={onSet} onSetMany={onSetMany} />);
  return { onSet, onSetMany };
}

describe('StanceMatrix', () => {
  it('sets a stance and its note from a cell', async () => {
    const { onSet } = renderMatrix({ '1|2': { value: 'wary' } });
    await userEvent.click(screen.getByRole('button', { name: 'Harrison → Mara: Wary' }));
    const editor = screen.getByRole('region', { name: 'Stance: Harrison Vale → Mara Quill' });
    await userEvent.selectOptions(within(editor).getByLabelText('Stance'), 'deal');
    expect(onSet).toHaveBeenLastCalledWith(1, 2, { value: 'deal' });
    await userEvent.type(within(editor).getByLabelText('Note'), 'x');
    expect(onSet).toHaveBeenLastCalledWith(1, 2, { value: 'wary', note: 'x' });
  });

  it('marks a strike on someone who thinks it’s an alliance, and lists planned strikes', () => {
    renderMatrix({ '1|2': { value: 'target', note: 'the ledger' }, '2|1': { value: 'ally' }, '3|1': { value: 'ally_target' } });
    expect(screen.getByRole('button', { name: 'Harrison → Mara: Target — the ledger' })).toHaveTextContent('⚠ Target ✎');
    const strikes = screen.getByRole('region', { name: 'Planned strikes' });
    expect(within(strikes).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'Harrison → Mara: Target — the ledger · they think it’s an alliance',
      'Ilse → Harrison: Ally ⇢ Target',
    ]);
  });

  it('sets several at once, starting from the focused player', async () => {
    const { onSetMany } = renderMatrix({}, 3);
    const several = screen.getByRole('region', { name: 'Set several at once' });
    const who = within(several).getByRole('group', { name: 'Who' });
    expect(within(who).getByLabelText('Ilse')).toBeChecked();
    const toward = within(several).getByRole('group', { name: 'Toward' });
    await userEvent.click(within(toward).getByLabelText('Harrison Vale'));
    await userEvent.click(within(toward).getByLabelText('Mara Quill'));
    await userEvent.click(within(toward).getByLabelText('Ilse'));
    await userEvent.selectOptions(within(several).getByLabelText('Stance'), 'wary');
    await userEvent.click(within(several).getByRole('button', { name: 'Set 2 stances' }));
    expect(onSetMany).toHaveBeenCalledWith(['3|1', '3|2'], 'wary');
  });
});
