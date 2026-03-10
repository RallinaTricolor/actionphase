import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ItemForm } from './ItemForm';

describe('ItemForm', () => {
  describe('Decimal support', () => {
    it('accepts decimal value for item value field', async () => {
      const onSubmit = vi.fn();
      const user = userEvent.setup();
      render(
        <ItemForm
          onSubmit={onSubmit}
          onCancel={vi.fn()}
          submitLabel="Add Item"
        />
      );

      // Fill in required name
      await user.type(screen.getByLabelText(/item name/i), 'Gold Ring');

      // Enter a decimal value
      const valueInput = screen.getByLabelText(/^value$/i);
      await user.clear(valueInput);
      await user.type(valueInput, '2.5');

      await user.click(screen.getByRole('button', { name: /add item/i }));

      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ value: 2.5 })
      );
    });

    it('accepts decimal value for item weight field', async () => {
      const onSubmit = vi.fn();
      const user = userEvent.setup();
      render(
        <ItemForm
          onSubmit={onSubmit}
          onCancel={vi.fn()}
          submitLabel="Add Item"
        />
      );

      await user.type(screen.getByLabelText(/item name/i), 'Iron Shield');

      const weightInput = screen.getByLabelText(/^weight$/i);
      await user.clear(weightInput);
      await user.type(weightInput, '3.5');

      await user.click(screen.getByRole('button', { name: /add item/i }));

      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ weight: 3.5 })
      );
    });
  });
});
