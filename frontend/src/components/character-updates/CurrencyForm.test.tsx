import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CurrencyForm } from './CurrencyForm';

describe('CurrencyForm', () => {
  describe('Decimal support', () => {
    it('accepts decimal amount', async () => {
      const onSubmit = vi.fn();
      const user = userEvent.setup();
      render(
        <CurrencyForm
          onSubmit={onSubmit}
          onCancel={vi.fn()}
          submitLabel="Add Currency"
        />
      );

      await user.type(screen.getByLabelText(/currency type/i), 'Gold');

      const amountInput = screen.getByLabelText(/^amount$/i);
      await user.clear(amountInput);
      await user.type(amountInput, '1.5');

      await user.click(screen.getByRole('button', { name: /add currency/i }));

      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 1.5 })
      );
    });
  });
});
