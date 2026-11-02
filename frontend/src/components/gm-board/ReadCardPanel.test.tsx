import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { makeBoard, makeCard, makeCodexEntry } from '@/test-utils/factories';
import { ReadCardPanel } from './ReadCardPanel';

const chunks = makeBoard().chunks;
const locations = [makeCodexEntry({ id: 'mill', type: 'Location', name: 'the Old Mill' })];
const base = {
  ownerName: 'Harrison Vale',
  locations,
  chunks,
  onCreateLocation: vi.fn(() => 'new'),
  onDelete: vi.fn(),
  onClose: vi.fn(),
};

describe('ReadCardPanel', () => {
  it('shows the quote and suggests its first sentence as the label', () => {
    const card = makeCard({ id: 'c', characterId: 1, locationId: 'mill', quote: 'I sneak into the mill at dusk. Then I wait.' });
    render(<ReadCardPanel {...base} card={card} onChange={vi.fn()} />);
    expect(screen.getByText('I sneak into the mill at dusk. Then I wait.')).toBeInTheDocument();
    expect(screen.getByLabelText(/Label on the board/)).toHaveAttribute('placeholder', 'I sneak into the mill at dusk.');
  });

  it('asks for a location when the card’s is gone from the codex', () => {
    render(<ReadCardPanel {...base} card={makeCard({ id: 'c', characterId: 1, locationId: 'deleted' })} onChange={vi.fn()} />);
    expect(screen.getByText('No location: pick one.')).toBeInTheDocument();
  });

  it('offers Contingencies only to an IF card', () => {
    const { rerender } = render(<ReadCardPanel {...base} card={makeCard({ id: 'c', characterId: 1, locationId: 'mill' })} onChange={vi.fn()} />);
    expect(screen.queryByRole('option', { name: /Contingencies/ })).not.toBeInTheDocument();
    rerender(<ReadCardPanel {...base} card={makeCard({ id: 'c', characterId: 1, locationId: 'mill', isIF: true })} onChange={vi.fn()} />);
    expect(screen.getByRole('option', { name: /Contingencies/ })).toBeInTheDocument();
  });

  it('puts a waiting card back in a time slot when it stops being an IF card', async () => {
    const onChange = vi.fn();
    const card = makeCard({ id: 'c', characterId: 1, locationId: 'mill', isIF: true, cond: 'if seen', chunkId: null });
    render(<ReadCardPanel {...base} card={card} onChange={onChange} />);
    await userEvent.click(screen.getByLabelText(/IF card/));
    expect(onChange).toHaveBeenCalledWith({ isIF: false, cond: '', branchOf: null, chunkId: 'k2' });
  });

  it('is read-only for a viewer', () => {
    render(<ReadCardPanel {...base} card={makeCard({ id: 'c', characterId: 1, locationId: 'mill' })} onChange={vi.fn()} readOnly />);
    expect(screen.queryByRole('button', { name: 'Delete card' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Time slot')).toBeDisabled();
  });
});
