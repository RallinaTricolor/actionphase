import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent as _fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AddAbilityModal } from '../AddAbilityModal';

describe('AddAbilityModal', () => {
  describe('Display', () => {
    it('renders modal with title', () => {
      render(<AddAbilityModal onAdd={vi.fn()} onCancel={vi.fn()} />);

      expect(screen.getByText('Add New Ability')).toBeInTheDocument();
    });

    it('renders all form fields', () => {
      render(<AddAbilityModal onAdd={vi.fn()} onCancel={vi.fn()} />);

      expect(screen.getByLabelText(/Ability Name/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Type/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Description/)).toBeInTheDocument();
    });

    it('renders action buttons', () => {
      render(<AddAbilityModal onAdd={vi.fn()} onCancel={vi.fn()} />);

      expect(screen.getByText('Cancel')).toBeInTheDocument();
      expect(screen.getByText('Add Ability')).toBeInTheDocument();
    });

    it('shows ability name field as required', () => {
      render(<AddAbilityModal onAdd={vi.fn()} onCancel={vi.fn()} />);

      const nameField = screen.getByLabelText(/Ability Name/);
      expect(nameField).toBeRequired();
    });

    it('shows type dropdown with default value "learned"', () => {
      render(<AddAbilityModal onAdd={vi.fn()} onCancel={vi.fn()} />);

      const typeSelect = screen.getByLabelText(/Type/) as HTMLSelectElement;
      expect(typeSelect).toHaveValue('learned');
    });

    it('shows type dropdown options', () => {
      render(<AddAbilityModal onAdd={vi.fn()} onCancel={vi.fn()} />);

      expect(screen.getByRole('option', { name: 'Learned' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Innate' })).toBeInTheDocument();
    });
  });

  describe('Form Input', () => {
    it('allows entering ability name', async () => {
      const _user = userEvent.setup();
      render(<AddAbilityModal onAdd={vi.fn()} onCancel={vi.fn()} />);

      const nameInput = screen.getByLabelText(/Ability Name/);
      await user.type(nameInput, 'Fireball');

      expect(nameInput).toHaveValue('Fireball');
    });

    it('allows selecting "innate" type', async () => {
      const _user = userEvent.setup();
      render(<AddAbilityModal onAdd={vi.fn()} onCancel={vi.fn()} />);

      const typeSelect = screen.getByLabelText(/Type/);
      await user.selectOptions(typeSelect, 'innate');

      expect(typeSelect).toHaveValue('innate');
    });

    it('allows selecting "learned" type', async () => {
      const _user = userEvent.setup();
      render(<AddAbilityModal onAdd={vi.fn()} onCancel={vi.fn()} />);

      const typeSelect = screen.getByLabelText(/Type/);
      // First change to innate, then back to learned
      await user.selectOptions(typeSelect, 'innate');
      await user.selectOptions(typeSelect, 'learned');

      expect(typeSelect).toHaveValue('learned');
    });

    it('allows entering description', async () => {
      const _user = userEvent.setup();
      render(<AddAbilityModal onAdd={vi.fn()} onCancel={vi.fn()} />);

      const descInput = screen.getByLabelText(/Description/);
      await user.type(descInput, 'Hurls a ball of flame');

      expect(descInput).toHaveValue('Hurls a ball of flame');
    });
  });

  describe('Form Submission', () => {
    it('calls onAdd with complete ability data', async () => {
      const onAdd = vi.fn();
      const _user = userEvent.setup();
      render(<AddAbilityModal onAdd={onAdd} onCancel={vi.fn()} />);

      await user.type(screen.getByLabelText(/Ability Name/), 'Fireball');
      await user.selectOptions(screen.getByLabelText(/Type/), 'learned');
      await user.type(screen.getByLabelText(/Description/), 'Hurls a ball of flame at enemies');

      await user.click(screen.getByText('Add Ability'));

      expect(onAdd).toHaveBeenCalledWith({
        name: 'Fireball',
        type: 'learned',
        description: 'Hurls a ball of flame at enemies',
        active: true
      });
    });

    it('calls onAdd with innate type', async () => {
      const onAdd = vi.fn();
      const _user = userEvent.setup();
      render(<AddAbilityModal onAdd={onAdd} onCancel={vi.fn()} />);

      await user.type(screen.getByLabelText(/Ability Name/), 'Dragon Breath');
      await user.selectOptions(screen.getByLabelText(/Type/), 'innate');
      await user.type(screen.getByLabelText(/Description/), 'Breathes fire');

      await user.click(screen.getByText('Add Ability'));

      expect(onAdd).toHaveBeenCalledWith({
        name: 'Dragon Breath',
        type: 'innate',
        description: 'Breathes fire',
        active: true
      });
    });

    it('calls onAdd with only required fields', async () => {
      const onAdd = vi.fn();
      const _user = userEvent.setup();
      render(<AddAbilityModal onAdd={onAdd} onCancel={vi.fn()} />);

      await user.type(screen.getByLabelText(/Ability Name/), 'Simple Ability');

      await user.click(screen.getByText('Add Ability'));

      expect(onAdd).toHaveBeenCalledWith({
        name: 'Simple Ability',
        type: 'learned',
        description: undefined,
        active: true
      });
    });

    it('trims whitespace from name', async () => {
      const onAdd = vi.fn();
      const _user = userEvent.setup();
      render(<AddAbilityModal onAdd={onAdd} onCancel={vi.fn()} />);

      await user.type(screen.getByLabelText(/Ability Name/), '  Fireball  ');
      await user.click(screen.getByText('Add Ability'));

      expect(onAdd).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Fireball' })
      );
    });

    it('trims whitespace from description', async () => {
      const onAdd = vi.fn();
      const _user = userEvent.setup();
      render(<AddAbilityModal onAdd={onAdd} onCancel={vi.fn()} />);

      await user.type(screen.getByLabelText(/Ability Name/), 'Ability');
      await user.type(screen.getByLabelText(/Description/), '  Powerful attack  ');
      await user.click(screen.getByText('Add Ability'));

      expect(onAdd).toHaveBeenCalledWith(
        expect.objectContaining({ description: 'Powerful attack' })
      );
    });

    it('sets empty description to undefined', async () => {
      const onAdd = vi.fn();
      const _user = userEvent.setup();
      render(<AddAbilityModal onAdd={onAdd} onCancel={vi.fn()} />);

      await user.type(screen.getByLabelText(/Ability Name/), 'Ability');
      await user.type(screen.getByLabelText(/Description/), '   ');
      await user.click(screen.getByText('Add Ability'));

      expect(onAdd).toHaveBeenCalledWith(
        expect.objectContaining({ description: undefined })
      );
    });

    it('does not call onAdd when name is empty', async () => {
      const onAdd = vi.fn();
      const _user = userEvent.setup();
      render(<AddAbilityModal onAdd={onAdd} onCancel={vi.fn()} />);

      await user.click(screen.getByText('Add Ability'));

      expect(onAdd).not.toHaveBeenCalled();
    });

    it('does not call onAdd when name is only whitespace', async () => {
      const onAdd = vi.fn();
      const _user = userEvent.setup();
      render(<AddAbilityModal onAdd={onAdd} onCancel={vi.fn()} />);

      await user.type(screen.getByLabelText(/Ability Name/), '   ');
      await user.click(screen.getByText('Add Ability'));

      expect(onAdd).not.toHaveBeenCalled();
    });

    it('sets active to true by default', async () => {
      const onAdd = vi.fn();
      const _user = userEvent.setup();
      render(<AddAbilityModal onAdd={onAdd} onCancel={vi.fn()} />);

      await user.type(screen.getByLabelText(/Ability Name/), 'Ability');
      await user.click(screen.getByText('Add Ability'));

      expect(onAdd).toHaveBeenCalledWith(
        expect.objectContaining({ active: true })
      );
    });
  });

  describe('Cancel Functionality', () => {
    it('calls onCancel when cancel button clicked', async () => {
      const onCancel = vi.fn();
      const _user = userEvent.setup();
      render(<AddAbilityModal onAdd={vi.fn()} onCancel={onCancel} />);

      await user.click(screen.getByText('Cancel'));

      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('does not call onAdd when cancelled', async () => {
      const onAdd = vi.fn();
      const _user = userEvent.setup();
      render(<AddAbilityModal onAdd={onAdd} onCancel={vi.fn()} />);

      await user.type(screen.getByLabelText(/Ability Name/), 'Ability');
      await user.click(screen.getByText('Cancel'));

      expect(onAdd).not.toHaveBeenCalled();
    });
  });
});
