import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EntryCard } from './EntryCard';
import type { CharacterSheetField } from '@/types/characters';
import type { SheetEntry } from '@/lib/sheetEntries';

const FIELDS: CharacterSheetField[] = [
  { key: 'rank', label: 'Rank', type: 'text' },
  { key: 'quantity', label: 'Quantity', type: 'number' },
  { key: 'description', label: 'Description', type: 'markdown' },
  { key: 'f_rel000', label: 'Relationship', type: 'select', options: ['Ally', 'Rival'] },
  { key: 'f_known0', label: 'Known', type: 'checkbox' },
  { key: 'f_trust0', label: 'Trust', type: 'track' },
];

const FULL: SheetEntry = {
  id: 'e1',
  name: 'Vex',
  rank: 'Expert',
  quantity: 1200,
  description: 'A **fence**',
  f_rel000: 'Rival',
  f_known0: true,
  f_trust0: { value: 2, max: 5, display: 'track' },
};

const renderCard = (props: Partial<React.ComponentProps<typeof EntryCard>> = {}) => {
  const onUpdate = vi.fn();
  const onRemove = vi.fn();
  render(<EntryCard entry={FULL} fields={FIELDS} canEdit={true} onUpdate={onUpdate} onRemove={onRemove} {...props} />);
  return { onUpdate, onRemove, user: userEvent.setup({ delay: null }) };
};

describe('EntryCard', () => {
  describe('display', () => {
    it('shows the name as the heading', () => {
      renderCard();
      expect(screen.getByRole('heading', { name: 'Vex' })).toBeInTheDocument();
    });

    it('shows text and number fields as label/value pairs', () => {
      renderCard();
      expect(screen.getByText('Rank:')).toBeInTheDocument();
      expect(screen.getByText('Expert')).toBeInTheDocument();
      expect(screen.getByText('Quantity:')).toBeInTheDocument();
      expect(screen.getByText((1200).toLocaleString())).toBeInTheDocument();
    });

    it('shows zero, which is a value rather than an absence', () => {
      renderCard({ entry: { id: 'e1', name: 'Vex', quantity: 0 } });
      expect(screen.getByText('Quantity:')).toBeInTheDocument();
      expect(screen.getByText('0')).toBeInTheDocument();
    });

    it('shows a select value as a badge', () => {
      renderCard();
      expect(screen.getByText('Rival')).toBeInTheDocument();
    });

    it('shows a checked checkbox as a badge with its label', () => {
      renderCard();
      expect(screen.getByText('Known')).toBeInTheDocument();
    });

    it('shows nothing for an unchecked checkbox', () => {
      renderCard({ entry: { ...FULL, f_known0: false } });
      expect(screen.queryByText('Known')).not.toBeInTheDocument();
    });

    it('shows a bounded track with its label and a bar', () => {
      renderCard();
      expect(screen.getByText('Trust')).toBeInTheDocument();
      expect(screen.getByRole('img', { name: 'Vex, Trust: 2 of 5' })).toBeInTheDocument();
    });

    it('leaves out every field with no value', () => {
      renderCard({ entry: { id: 'e1', name: 'Vex', rank: '  ' } });
      for (const label of ['Rank:', 'Quantity:', 'Description', 'Known', 'Trust']) {
        expect(screen.queryByText(label)).not.toBeInTheDocument();
      }
    });

    it('lays groups out in a fixed order whatever the schema order', () => {
      // Meta line (in schema order), then tracks, then sections, then badges.
      renderCard({ fields: [...FIELDS].reverse() });
      const text = document.body.textContent ?? '';
      const order = ['Quantity:', 'Rank:', 'Trust', 'Description', 'Known', 'Rival']
        .map(label => text.indexOf(label));
      expect(order.every(i => i >= 0)).toBe(true);
      expect(order).toEqual([...order].sort((a, b) => a - b));
    });

    it('ignores a field of a type this client does not know', () => {
      renderCard({ fields: [{ key: 'rank', label: 'Dial', type: 'dial' as CharacterSheetField['type'] }] });
      expect(screen.queryByText('Dial')).not.toBeInTheDocument();
      expect(screen.queryByText('Expert')).not.toBeInTheDocument();
    });
  });

  describe('markdown sections', () => {
    it('are collapsed by default', () => {
      renderCard();
      expect(screen.getByRole('button', { name: 'Description' })).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByText('fence')).not.toBeInTheDocument();
    });

    it('expand and collapse, rendering markdown', async () => {
      const { user } = renderCard();
      const toggle = screen.getByRole('button', { name: 'Description' });

      await user.click(toggle);
      expect(toggle).toHaveAttribute('aria-expanded', 'true');
      expect(screen.getByText('fence').tagName).toBe('STRONG');

      await user.click(toggle);
      expect(screen.queryByText('fence')).not.toBeInTheDocument();
    });

    it('are left out when empty', () => {
      renderCard({ entry: { ...FULL, description: '' } });
      expect(screen.queryByRole('button', { name: 'Description' })).not.toBeInTheDocument();
    });
  });

  describe('editing', () => {
    it('hides the edit and remove controls from viewers who cannot edit', () => {
      renderCard({ canEdit: false });
      expect(screen.queryByRole('button', { name: 'Edit entry' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Remove entry' })).not.toBeInTheDocument();
    });

    it('removes', async () => {
      const { onRemove, user } = renderCard();
      await user.click(screen.getByRole('button', { name: 'Remove entry' }));
      expect(onRemove).toHaveBeenCalled();
    });

    it('swaps to the form pre-filled with the entry, and back on cancel', async () => {
      const { onUpdate, user } = renderCard();
      await user.click(screen.getByRole('button', { name: 'Edit entry' }));

      expect(screen.getByRole('textbox', { name: 'Name *' })).toHaveValue('Vex');
      expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(screen.getByRole('heading', { name: 'Vex' })).toBeInTheDocument();
      expect(onUpdate).not.toHaveBeenCalled();
    });

    it('hands the edit up on save and returns to the card', async () => {
      const { onUpdate, user } = renderCard();
      await user.click(screen.getByRole('button', { name: 'Edit entry' }));
      const rank = screen.getByRole('textbox', { name: 'Rank' });
      await user.clear(rank);
      await user.type(rank, 'Master');
      await user.click(screen.getByRole('button', { name: 'Save' }));

      expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({
        name: 'Vex',
        values: expect.objectContaining({ rank: 'Master', quantity: 1200 }),
      }));
      expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
    });

    it('reports dirty while the editor holds edits, and clean once cancelled', async () => {
      const onDirtyChange = vi.fn();
      const { user } = renderCard({ onDirtyChange });
      await user.click(screen.getByRole('button', { name: 'Edit entry' }));
      await user.type(screen.getByRole('textbox', { name: 'Rank' }), '!');
      expect(onDirtyChange).toHaveBeenLastCalledWith(true);

      await user.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(onDirtyChange).toHaveBeenLastCalledWith(false);
    });
  });
});
