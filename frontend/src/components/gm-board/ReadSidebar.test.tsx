import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { makeBoard, makeCard, makeCodexEntry } from '@/test-utils/factories';
import { ReadSidebar } from './ReadSidebar';

const names = new Map([
  [1, 'Harrison Vale'],
  [2, 'Mara'],
  [3, 'Ilse'],
  [9, 'Bo Hale'],
]);
const base = {
  ownerId: 1,
  names,
  submitters: [1, 2, 3],
  stances: {},
  cards: [],
  chunks: makeBoard().chunks,
  codex: [makeCodexEntry({ id: 'mill', type: 'Location', name: 'the Old Mill', notes: 'Burned down last winter.' })],
  links: { mentions: [3, 9], codexIds: ['mill'], mentionedBy: [], samePlace: [] },
  onSetStance: vi.fn(),
  onOpenCard: vi.fn(),
  onPickSubmission: vi.fn(),
};

describe('ReadSidebar', () => {
  it('lists named people first in stances, with their stance back', () => {
    render(<ReadSidebar {...base} stances={{ '3|1': { value: 'wary' } }} />);
    const selects = screen.getAllByRole('combobox');
    expect(selects.map((s) => s.getAttribute('aria-label'))).toEqual(['Harrison Vale toward Ilse', 'Harrison Vale toward Mara']);
    expect(screen.getByText('Wary back')).toBeInTheDocument();
  });

  it('links named people who submitted, and only names the rest', () => {
    render(<ReadSidebar {...base} />);
    const section = screen.getByText('Names (2)').closest('section')!;
    expect(within(section).getByRole('button', { name: 'Ilse' })).toBeInTheDocument();
    expect(within(section).queryByRole('button', { name: 'Bo Hale' })).not.toBeInTheDocument();
    expect(within(section).getByText('Bo Hale')).toBeInTheDocument();
  });

  it('lists the owner’s cards in time order with where they are', () => {
    const cards = [
      makeCard({ id: 'b', characterId: 1, summary: 'Later', chunkId: 'k3', locationId: 'mill' }),
      makeCard({ id: 'a', characterId: 1, summary: 'Wait', chunkId: null, isIF: true, locationId: 'gone' }),
      makeCard({ id: 'c', characterId: 2, summary: 'Not mine' }),
    ];
    render(<ReadSidebar {...base} cards={cards} />);
    const section = screen.getByText('Board cards (2)').closest('section')!;
    expect(within(section).getAllByRole('button').map((b) => b.textContent)).toEqual([
      'IFWaitNo location · Contingencies',
      'Laterthe Old Mill · Slot 2',
    ]);
  });

  it('shows codex matches with their notes', () => {
    render(<ReadSidebar {...base} />);
    expect(screen.getByText('Burned down last winter.')).toBeInTheDocument();
  });
});
