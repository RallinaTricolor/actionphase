import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EntryForm } from './EntryForm';
import type { CharacterSheetField } from '@/types/characters';
import type { SheetEntry } from '@/lib/sheetEntries';

/** One field of every type, in the order a GM might list them. */
const ALL_TYPES: CharacterSheetField[] = [
  { key: 'rank', label: 'Rank', type: 'text' },
  { key: 'quantity', label: 'Quantity', type: 'number' },
  { key: 'description', label: 'Description', type: 'markdown' },
  { key: 'f_rel000', label: 'Relationship', type: 'select', options: ['Ally', 'Rival'] },
  { key: 'f_known0', label: 'Known', type: 'checkbox' },
  { key: 'f_trust0', label: 'Trust', type: 'track' },
];

const renderForm = (props: Partial<React.ComponentProps<typeof EntryForm>> = {}) => {
  const onSubmit = vi.fn();
  const onDirtyChange = vi.fn();
  render(
    <EntryForm fields={ALL_TYPES} onSubmit={onSubmit} onCancel={vi.fn()} onDirtyChange={onDirtyChange} {...props} />
  );
  return { onSubmit, onDirtyChange, user: userEvent.setup({ delay: null }) };
};

const trust = () => within(screen.getByRole('group', { name: 'Trust' }));
const lastDirty = (onDirtyChange: ReturnType<typeof vi.fn>) => onDirtyChange.mock.calls.at(-1)?.[0];

describe('EntryForm', () => {
  describe('inputs', () => {
    it('renders the name and one input per field, labelled by the schema', () => {
      renderForm();

      expect(screen.getByRole('textbox', { name: 'Name *' })).toBeRequired();
      expect(screen.getByRole('textbox', { name: 'Rank' })).toBeInTheDocument();
      expect(screen.getByRole('spinbutton', { name: 'Quantity' })).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: /Description/ })).toBeInTheDocument();
      expect(screen.getByRole('combobox', { name: 'Relationship' })).toBeInTheDocument();
      expect(screen.getByRole('checkbox', { name: 'Known' })).toBeInTheDocument();
      expect(trust().getByRole('spinbutton', { name: 'Current' })).toBeInTheDocument();
      expect(trust().getByRole('spinbutton', { name: 'Maximum' })).toBeInTheDocument();
    });

    it('uses the markdown editor for markdown fields', () => {
      renderForm({ fields: [ALL_TYPES[2]] });
      // CommentEditor renders Write/Preview tabs; a plain textarea does not.
      expect(screen.getByRole('button', { name: /^write$/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^preview$/i })).toBeInTheDocument();
    });

    it('offers the select\'s options plus None', () => {
      renderForm({ fields: [ALL_TYPES[3]] });
      const options = within(screen.getByRole('combobox', { name: 'Relationship' })).getAllByRole('option');
      expect(options.map(o => o.textContent)).toEqual(['None', 'Ally', 'Rival']);
    });

    it('keeps a stored select value the GM has since removed from the options', () => {
      // Otherwise opening and saving the entry would silently clear it.
      renderForm({ fields: [ALL_TYPES[3]], initialEntry: { id: 'e1', name: 'Vex', f_rel000: 'Patron' } });
      expect(screen.getByRole('combobox', { name: 'Relationship' })).toHaveValue('Patron');
    });

    it('shows the track display choice only once there is a maximum', async () => {
      const { user } = renderForm({ fields: [ALL_TYPES[5]] });
      expect(trust().queryByRole('combobox', { name: 'Display as' })).not.toBeInTheDocument();

      await user.type(trust().getByRole('spinbutton', { name: 'Maximum' }), '5');

      expect(trust().getByRole('combobox', { name: 'Display as' })).toBeInTheDocument();
    });

    it('skips a field of a type this client does not know', () => {
      renderForm({ fields: [{ key: 'f_dial00', label: 'Dial', type: 'dial' as CharacterSheetField['type'] }] });
      expect(screen.queryByText('Dial')).not.toBeInTheDocument();
    });

    it('pre-fills every input from the entry being edited', () => {
      renderForm({
        initialEntry: {
          id: 'e1', name: 'Vex', rank: 'Expert', quantity: 3, description: 'A fence',
          f_rel000: 'Rival', f_known0: true, f_trust0: { value: 2, max: 5, display: 'boxes' },
        },
      });

      expect(screen.getByRole('textbox', { name: 'Name *' })).toHaveValue('Vex');
      expect(screen.getByRole('textbox', { name: 'Rank' })).toHaveValue('Expert');
      expect(screen.getByRole('spinbutton', { name: 'Quantity' })).toHaveValue(3);
      expect(screen.getByDisplayValue('A fence')).toBeInTheDocument();
      expect(screen.getByRole('combobox', { name: 'Relationship' })).toHaveValue('Rival');
      expect(screen.getByRole('checkbox', { name: 'Known' })).toBeChecked();
      expect(trust().getByRole('spinbutton', { name: 'Current' })).toHaveValue(2);
      expect(trust().getByRole('spinbutton', { name: 'Maximum' })).toHaveValue(5);
      expect(trust().getByRole('combobox', { name: 'Display as' })).toHaveValue('boxes');
    });
  });

  describe('submitting', () => {
    it('hands back every field as its stored type', async () => {
      const { onSubmit, user } = renderForm();

      await user.type(screen.getByRole('textbox', { name: 'Name *' }), '  Vex  ');
      await user.type(screen.getByRole('textbox', { name: 'Rank' }), ' Expert ');
      await user.type(screen.getByRole('spinbutton', { name: 'Quantity' }), '2.5');
      await user.type(screen.getByRole('textbox', { name: /Description/ }), 'A **fence**');
      await user.selectOptions(screen.getByRole('combobox', { name: 'Relationship' }), 'Ally');
      await user.click(screen.getByRole('checkbox', { name: 'Known' }));
      await user.type(trust().getByRole('spinbutton', { name: 'Current' }), '3');
      await user.type(trust().getByRole('spinbutton', { name: 'Maximum' }), '6');
      await user.selectOptions(trust().getByRole('combobox', { name: 'Display as' }), 'track');
      await user.click(screen.getByRole('button', { name: 'Add' }));

      expect(onSubmit).toHaveBeenCalledWith({
        name: 'Vex',
        values: {
          rank: 'Expert',
          quantity: 2.5,
          description: 'A **fence**',
          f_rel000: 'Ally',
          f_known0: true,
          f_trust0: { value: 3, max: 6, display: 'track' },
        },
      });
    });

    it('reports every empty field as cleared', async () => {
      const { onSubmit, user } = renderForm();

      await user.type(screen.getByRole('textbox', { name: 'Name *' }), 'Vex');
      await user.type(screen.getByRole('textbox', { name: 'Rank' }), '   ');
      await user.click(screen.getByRole('button', { name: 'Add' }));

      const { values } = onSubmit.mock.calls[0][0];
      expect(Object.keys(values)).toEqual(ALL_TYPES.map(f => f.key));
      expect(Object.values(values).every(v => v === undefined)).toBe(true);
    });

    it('clears a value that was emptied while editing', async () => {
      const { onSubmit, user } = renderForm({
        initialEntry: { id: 'e1', name: 'Vex', rank: 'Expert', f_known0: true },
        submitLabel: 'Save',
      });

      await user.clear(screen.getByRole('textbox', { name: 'Rank' }));
      await user.click(screen.getByRole('checkbox', { name: 'Known' }));
      await user.click(screen.getByRole('button', { name: 'Save' }));

      const { values } = onSubmit.mock.calls[0][0];
      expect(values.rank).toBeUndefined();
      expect(values.f_known0).toBeUndefined();
    });

    it('stores a track with only a current value as unbounded', async () => {
      const { onSubmit, user } = renderForm({ fields: [ALL_TYPES[5]] });
      await user.type(screen.getByRole('textbox', { name: 'Name *' }), 'Vex');
      await user.type(trust().getByRole('spinbutton', { name: 'Current' }), '4');
      await user.click(screen.getByRole('button', { name: 'Add' }));

      expect(onSubmit.mock.calls[0][0].values.f_trust0).toEqual({ value: 4 });
    });

    it('never stores a display mode without a maximum to draw it against', async () => {
      const { onSubmit, user } = renderForm({
        fields: [ALL_TYPES[5]],
        initialEntry: { id: 'e1', name: 'Vex', f_trust0: { value: 2, max: 5, display: 'boxes' } },
        submitLabel: 'Save',
      });
      await user.clear(trust().getByRole('spinbutton', { name: 'Maximum' }));
      await user.click(screen.getByRole('button', { name: 'Save' }));

      expect(onSubmit.mock.calls[0][0].values.f_trust0).toEqual({ value: 2 });
    });

    it('does not submit without a name', async () => {
      const { onSubmit, user } = renderForm();
      await user.type(screen.getByRole('textbox', { name: 'Name *' }), '   ');
      await user.click(screen.getByRole('button', { name: 'Add' }));
      expect(onSubmit).not.toHaveBeenCalled();
    });

    it('does not submit on cancel', async () => {
      const onCancel = vi.fn();
      const { onSubmit, user } = renderForm({ onCancel });
      await user.type(screen.getByRole('textbox', { name: 'Name *' }), 'Vex');
      await user.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(onCancel).toHaveBeenCalled();
      expect(onSubmit).not.toHaveBeenCalled();
    });
  });

  describe('unsaved-edit reporting', () => {
    const saved: SheetEntry = { id: 'e1', name: 'Vex', rank: 'Expert', quantity: 3 };

    it('reports clean before anything is edited', () => {
      const { onDirtyChange } = renderForm({ initialEntry: saved });
      expect(lastDirty(onDirtyChange)).toBe(false);
    });

    it('reports dirty once a field diverges from the saved value', async () => {
      const { onDirtyChange, user } = renderForm({ initialEntry: saved });
      await user.type(screen.getByRole('textbox', { name: 'Rank' }), '+');
      expect(lastDirty(onDirtyChange)).toBe(true);
    });

    it('stays clean for an edit Save would discard', async () => {
      // Trailing whitespace is trimmed on save; reporting it dirty would lock
      // the sheet's tabs with nothing left to commit.
      const { onDirtyChange, user } = renderForm({ initialEntry: saved });
      await user.type(screen.getByRole('textbox', { name: 'Rank' }), '   ');
      expect(lastDirty(onDirtyChange)).toBe(false);
    });

    it('reports clean again once the edit is reverted', async () => {
      const { onDirtyChange, user } = renderForm({ initialEntry: saved });
      const quantity = screen.getByRole('spinbutton', { name: 'Quantity' });
      await user.clear(quantity);
      await user.type(quantity, '4');
      expect(lastDirty(onDirtyChange)).toBe(true);
      await user.clear(quantity);
      await user.type(quantity, '3');
      expect(lastDirty(onDirtyChange)).toBe(false);
    });

    it('reports clean on unmount', () => {
      const onDirtyChange = vi.fn();
      const { unmount } = render(
        <EntryForm fields={ALL_TYPES} onSubmit={vi.fn()} onCancel={vi.fn()} onDirtyChange={onDirtyChange} />
      );
      unmount();
      expect(lastDirty(onDirtyChange)).toBe(false);
    });
  });

  it('gives each open form its own input ids', () => {
    // Two cards can be mid-edit at once; shared ids would point both labels
    // at the first form's inputs.
    render(
      <>
        <EntryForm fields={ALL_TYPES} onSubmit={vi.fn()} onCancel={vi.fn()} />
        <EntryForm fields={ALL_TYPES} onSubmit={vi.fn()} onCancel={vi.fn()} />
      </>
    );
    const [first, second] = screen.getAllByRole('textbox', { name: 'Rank' });
    expect(first.id).not.toBe(second.id);
  });
});
