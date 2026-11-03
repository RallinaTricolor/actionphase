import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { makeMoment } from '@/test-utils/factories';
import { SceneReadsAs } from './SceneReadsAs';
import { sceneModel } from './sceneTestModel';

// A four-person fight as one list of moments: who reads each, and one own version.
const fight = sceneModel({
  participants: [1, 2, 3, 4, 9],
  moments: [
    makeMoment({ id: 'm1', text: 'Harrison draws on Mara.', readers: [1, 2, 3, 4] }),
    makeMoment({ id: 'm2', text: 'Mara ducks behind the wheel.', readers: [1, 2, 3, 4], ownText: { 2: 'The shot grazes your ear as you duck.' } }),
    makeMoment({ id: 'm3', text: 'Ilse slips out the back.', readers: [3] }),
    makeMoment({ id: 'm4', text: 'Tov was paid to let it happen.', readers: [] }),
    makeMoment({ id: 'm5', text: 'Harrison hears Ilse leave.', readers: [1, 4] }),
  ],
});

function renderAs(reader: number | null, model = fight) {
  const props = { onReader: vi.fn(), onFocusMoment: vi.fn(), onCopy: vi.fn() };
  render(<SceneReadsAs model={model} reader={reader} focusedId={null} {...props} />);
  return props;
}

const shown = () => screen.getAllByTestId(/^reads-as-/).map((el) => el.textContent?.replace(/^\d+/, '').replace(/own$/, '').trim());

describe('SceneReadsAs', () => {
  it.each([
    [1, ['You draw on Mara.', 'Mara ducks behind the wheel.', 'You hear Ilse leave.']],
    [2, ['Harrison draws on you.', 'The shot grazes your ear as you duck.']],
    [3, ['Harrison draws on Mara.', 'Mara ducks behind the wheel.', 'You slip out the back.']],
    [4, ['Harrison draws on Mara.', 'Mara ducks behind the wheel.', 'Harrison hears Ilse leave.']],
  ])('shows character %i exactly what they get, in second person', (id, lines) => {
    renderAs(id);
    expect(shown()).toEqual(lines);
  });

  it('marks an own version, and never shows a GM note', async () => {
    renderAs(2);
    expect(within(screen.getByTestId('reads-as-m2')).getByText('own')).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText('Show what Mara misses'));
    expect(screen.getByTestId('reads-as-m3')).toHaveTextContent('Not ticked on this moment');
    expect(screen.queryByTestId('reads-as-m4')).not.toBeInTheDocument();
  });

  it('lists only people who read results, starting with the first', async () => {
    const h = renderAs(null);
    const readers = within(screen.getByRole('group', { name: 'Reader' })).getAllByRole('button');
    // Each button starts with the avatar's initial.
    expect(readers.map((b) => b.textContent)).toEqual(['HHarrison', 'MMara', 'IIlse', 'TTov']);
    expect(readers[0]).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(readers[2]);
    expect(h.onReader).toHaveBeenCalledWith(3);
  });

  it('copies the reader’s version and focuses a moment from it', async () => {
    const h = renderAs(3);
    await userEvent.click(screen.getByRole('button', { name: 'Copy Ilse’s version' }));
    expect(h.onCopy).toHaveBeenCalledWith('Harrison draws on Mara.\n\nMara ducks behind the wheel.\n\nYou slip out the back.');
    await userEvent.click(screen.getByTestId('reads-as-m3'));
    expect(h.onFocusMoment).toHaveBeenCalledWith('m3');
  });

  it('keeps the shared text as written with second person off', () => {
    renderAs(1, sceneModel({ participants: [1], moments: [makeMoment({ id: 'm', text: 'Harrison waits.', readers: [1] })] }, {}, false));
    expect(shown()).toEqual(['Harrison waits.']);
  });

  it('says so when nobody in the scene reads results', () => {
    renderAs(null, sceneModel({ participants: [9] }));
    expect(screen.getByText('Nobody in this scene reads results yet.')).toBeInTheDocument();
  });
});
