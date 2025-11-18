import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AddCurrencyModal } from '../AddCurrencyModal';

describe('AddCurrencyModal', () => {
  describe('Display', () => {
    it('renders modal with title', () => {
      render(<AddCurrencyModal onAdd={vi.fn()} onCancel={vi.fn()} />);

      expect(screen.getByText('Add Currency/Resource')).toBeInTheDocument();
    });

    it('renders all form fields', () => {
      render(<AddCurrencyModal onAdd={vi.fn()} onCancel={vi.fn()} />);

      expect(screen.getByLabelText(/Currency Type/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Amount/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Description/)).toBeInTheDocument();
    });

    it('renders action buttons', () => {
      render(<AddCurrencyModal onAdd={vi.fn()} onCancel={vi.fn()} />);

      expect(screen.getByText('Cancel')).toBeInTheDocument();
      expect(screen.getByText('Add Currency')).toBeInTheDocument();
    });

    it('shows currency type field as required', () => {
      render(<AddCurrencyModal onAdd={vi.fn()} onCancel={vi.fn()} />);

      const typeField = screen.getByLabelText(/Currency Type/);
      expect(typeField).toBeRequired();
    });

    it('shows amount field with placeholder "0"', () => {
      render(<AddCurrencyModal onAdd={vi.fn()} onCancel={vi.fn()} />);

      const amountField = screen.getByLabelText(/Amount/) as HTMLInputElement;
      expect(amountField.placeholder).toBe('0');
      expect(amountField).toHaveValue(null);
    });
  });

  describe('Form Input', () => {
    it('allows entering currency type', async () => {
      const user = userEvent.setup();
      render(<AddCurrencyModal onAdd={vi.fn()} onCancel={vi.fn()} />);

      const typeInput = screen.getByLabelText(/Currency Type/);
      await user.type(typeInput, 'Gold');

      expect(typeInput).toHaveValue('Gold');
    });

    it('allows entering amount', () => {
      render(<AddCurrencyModal onAdd={vi.fn()} onCancel={vi.fn()} />);

      const amountInput = screen.getByLabelText(/Amount/) as HTMLInputElement;
      fireEvent.change(amountInput, { target: { value: '1000' } });

      expect(amountInput).toHaveValue(1000);
    });

    it('allows entering description', async () => {
      const user = userEvent.setup();
      render(<AddCurrencyModal onAdd={vi.fn()} onCancel={vi.fn()} />);

      const descInput = screen.getByLabelText(/Description/);
      await user.type(descInput, 'Standard currency');

      expect(descInput).toHaveValue('Standard currency');
    });
  });

  describe('Form Submission', () => {
    it('calls onAdd with complete currency data', async () => {
      const onAdd = vi.fn();
      const user = userEvent.setup();
      render(<AddCurrencyModal onAdd={onAdd} onCancel={vi.fn()} />);

      await user.type(screen.getByLabelText(/Currency Type/), 'Gold');
      fireEvent.change(screen.getByLabelText(/Amount/), { target: { value: '5000' } });
      await user.type(screen.getByLabelText(/Description/), 'Imperial gold coins');

      await user.click(screen.getByText('Add Currency'));

      expect(onAdd).toHaveBeenCalledWith({
        type: 'Gold',
        amount: 5000,
        description: 'Imperial gold coins'
      });
    });

    it('calls onAdd with only required fields', async () => {
      const onAdd = vi.fn();
      const user = userEvent.setup();
      render(<AddCurrencyModal onAdd={onAdd} onCancel={vi.fn()} />);

      await user.type(screen.getByLabelText(/Currency Type/), 'Silver');

      await user.click(screen.getByText('Add Currency'));

      expect(onAdd).toHaveBeenCalledWith({
        type: 'Silver',
        amount: 0,
        description: undefined
      });
    });

    it('trims whitespace from type', async () => {
      const onAdd = vi.fn();
      const user = userEvent.setup();
      render(<AddCurrencyModal onAdd={onAdd} onCancel={vi.fn()} />);

      await user.type(screen.getByLabelText(/Currency Type/), '  Gold  ');
      await user.click(screen.getByText('Add Currency'));

      expect(onAdd).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'Gold' })
      );
    });

    it('trims whitespace from description', async () => {
      const onAdd = vi.fn();
      const user = userEvent.setup();
      render(<AddCurrencyModal onAdd={onAdd} onCancel={vi.fn()} />);

      await user.type(screen.getByLabelText(/Currency Type/), 'Credits');
      await user.type(screen.getByLabelText(/Description/), '  Space money  ');
      await user.click(screen.getByText('Add Currency'));

      expect(onAdd).toHaveBeenCalledWith(
        expect.objectContaining({ description: 'Space money' })
      );
    });

    it('sets empty description to undefined', async () => {
      const onAdd = vi.fn();
      const user = userEvent.setup();
      render(<AddCurrencyModal onAdd={onAdd} onCancel={vi.fn()} />);

      await user.type(screen.getByLabelText(/Currency Type/), 'Gold');
      await user.type(screen.getByLabelText(/Description/), '   ');
      await user.click(screen.getByText('Add Currency'));

      expect(onAdd).toHaveBeenCalledWith(
        expect.objectContaining({ description: undefined })
      );
    });

    it('does not call onAdd when type is empty', async () => {
      const onAdd = vi.fn();
      const user = userEvent.setup();
      render(<AddCurrencyModal onAdd={onAdd} onCancel={vi.fn()} />);

      await user.click(screen.getByText('Add Currency'));

      expect(onAdd).not.toHaveBeenCalled();
    });

    it('does not call onAdd when type is only whitespace', async () => {
      const onAdd = vi.fn();
      const user = userEvent.setup();
      render(<AddCurrencyModal onAdd={onAdd} onCancel={vi.fn()} />);

      await user.type(screen.getByLabelText(/Currency Type/), '   ');
      await user.click(screen.getByText('Add Currency'));

      expect(onAdd).not.toHaveBeenCalled();
    });
  });

  describe('Cancel Functionality', () => {
    it('calls onCancel when cancel button clicked', async () => {
      const onCancel = vi.fn();
      const user = userEvent.setup();
      render(<AddCurrencyModal onAdd={vi.fn()} onCancel={onCancel} />);

      await user.click(screen.getByText('Cancel'));

      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('does not call onAdd when cancelled', async () => {
      const onAdd = vi.fn();
      const user = userEvent.setup();
      render(<AddCurrencyModal onAdd={onAdd} onCancel={vi.fn()} />);

      await user.type(screen.getByLabelText(/Currency Type/), 'Gold');
      await user.click(screen.getByText('Cancel'));

      expect(onAdd).not.toHaveBeenCalled();
    });
  });

  describe('Number Field Behavior', () => {
    it('allows amount field to be empty', () => {
      render(<AddCurrencyModal onAdd={vi.fn()} onCancel={vi.fn()} />);

      const amountInput = screen.getByLabelText(/Amount/) as HTMLInputElement;
      fireEvent.change(amountInput, { target: { value: '100' } });
      expect(amountInput).toHaveValue(100);

      fireEvent.change(amountInput, { target: { value: '' } });
      expect(amountInput).toHaveValue(null);
    });
  });
});
