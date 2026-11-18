import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { makeBoard } from '@/test-utils/factories';
import { GmCardsForm } from './GmCardsForm';
import { CAST } from './mapTestModel';

const locations = [
  { id: 'mill', name: 'the Old Mill' },
  { id: 'dock', name: 'dock' },
];

function renderForm(prefill = {}) {
  const handlers = { onCreateLocation: vi.fn(() => 'new'), onSubmit: vi.fn(), onCancel: vi.fn() };
  render(<GmCardsForm cast={CAST} locations={locations} slots={makeBoard().chunks} prefill={prefill} {...handlers} />);
  return handlers;
}

describe('GmCardsForm', () => {
  it('puts one card per person picked in one cell', async () => {
    const { onSubmit } = renderForm({ locationId: 'dock', chunkId: 'k2' });
    const add = screen.getByRole('button', { name: 'Add card' });
    expect(add).toBeDisabled();
    await userEvent.click(screen.getByLabelText('Harrison Vale'));
    await userEvent.click(screen.getByLabelText('Bo Hale'));
    await userEvent.type(screen.getByLabelText('What happens'), ' The watch passes ');
    await userEvent.click(screen.getByRole('button', { name: 'Add 2 cards' }));
    expect(onSubmit).toHaveBeenCalledWith({ characterIds: [1, 9], locationId: 'dock', chunkId: 'k2', summary: 'The watch passes' });
  });

  it('starts from the row it was opened on', () => {
    renderForm({ characterIds: [3], chunkId: 'k3' });
    expect(screen.getByLabelText('Ilse')).toBeChecked();
    expect(screen.getByLabelText('Time slot')).toHaveValue('k3');
    expect(screen.getByRole('button', { name: 'Add card' })).toBeDisabled();
  });
});
