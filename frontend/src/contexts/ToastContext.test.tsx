import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastProvider, useToast } from './ToastContext';

function Trigger({ onUndo }: { onUndo: () => void }) {
  const { showToast } = useToast();
  return (
    <>
      <button onClick={() => showToast('Card deleted', 'info', { action: { label: 'Undo', onClick: onUndo } })}>delete</button>
      <button onClick={() => showToast('Saved', 'success')}>save</button>
    </>
  );
}

describe('ToastContext', () => {
  it('runs a toast’s action and closes it', async () => {
    const onUndo = vi.fn();
    render(
      <ToastProvider>
        <Trigger onUndo={onUndo} />
      </ToastProvider>,
    );
    await userEvent.click(screen.getByText('delete'));
    expect(screen.getByText('Card deleted')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(onUndo).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Card deleted')).not.toBeInTheDocument();
  });

  it('shows a plain toast with no button, and two toasts at once', async () => {
    render(
      <ToastProvider>
        <Trigger onUndo={vi.fn()} />
      </ToastProvider>,
    );
    await userEvent.click(screen.getByText('save'));
    await userEvent.click(screen.getByText('save'));
    expect(screen.getAllByText('Saved')).toHaveLength(2);
    expect(screen.queryByRole('button', { name: 'Undo' })).not.toBeInTheDocument();
  });
});
