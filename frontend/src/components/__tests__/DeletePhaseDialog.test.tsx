import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DeletePhaseDialog } from '../DeletePhaseDialog';
import type { GamePhase } from '../../types/phases';

const mockPhase: GamePhase = {
  id: 1,
  game_id: 100,
  phase_type: 'common_room',
  phase_number: 1,
  title: 'Test Phase',
  description: 'A test phase description',
  is_active: false,
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
};

describe('DeletePhaseDialog', () => {
  it('should render with phase information', () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn();

    render(
      <DeletePhaseDialog
        isOpen={true}
        onClose={onClose}
        onConfirm={onConfirm}
        phase={mockPhase}
      />
    );

    // Check title using role
    expect(screen.getByRole('heading', { name: 'Delete Phase' })).toBeInTheDocument();

    // Check warning message
    expect(screen.getByText(/This phase can only be deleted if it has no associated content/)).toBeInTheDocument();

    // Check phase info
    expect(screen.getByText('Test Phase (common_room)')).toBeInTheDocument();
    expect(screen.getByText('A test phase description')).toBeInTheDocument();

    // Check buttons
    expect(screen.getByTestId('delete-phase-cancel-button')).toBeInTheDocument();
    expect(screen.getByTestId('delete-phase-confirm-button')).toBeInTheDocument();
  });

  it('should call onConfirm when Delete button clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onConfirm = vi.fn().mockResolvedValue(undefined);

    render(
      <DeletePhaseDialog
        isOpen={true}
        onClose={onClose}
        onConfirm={onConfirm}
        phase={mockPhase}
      />
    );

    const deleteButton = screen.getByTestId('delete-phase-confirm-button');
    await user.click(deleteButton);

    expect(onConfirm).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  it('should close when Cancel button clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onConfirm = vi.fn();

    render(
      <DeletePhaseDialog
        isOpen={true}
        onClose={onClose}
        onConfirm={onConfirm}
        phase={mockPhase}
      />
    );

    const cancelButton = screen.getByTestId('delete-phase-cancel-button');
    await user.click(cancelButton);

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('should display error message when deletion fails', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const errorMessage = 'cannot delete phase: 2 action submission(s) exist for this phase';
    const onConfirm = vi.fn().mockRejectedValue(new Error(errorMessage));

    // Suppress console.error for this test
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <DeletePhaseDialog
        isOpen={true}
        onClose={onClose}
        onConfirm={onConfirm}
        phase={mockPhase}
      />
    );

    const deleteButton = screen.getByTestId('delete-phase-confirm-button');
    await user.click(deleteButton);

    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });

    // Should NOT close on error
    expect(onClose).not.toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });

  it('should disable buttons while submitting', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    let resolveConfirm: () => void;
    const confirmPromise = new Promise<void>((resolve) => {
      resolveConfirm = resolve;
    });
    const onConfirm = vi.fn().mockReturnValue(confirmPromise);

    render(
      <DeletePhaseDialog
        isOpen={true}
        onClose={onClose}
        onConfirm={onConfirm}
        phase={mockPhase}
      />
    );

    const deleteButton = screen.getByTestId('delete-phase-confirm-button');
    const cancelButton = screen.getByTestId('delete-phase-cancel-button');

    await user.click(deleteButton);

    // Buttons should be disabled while submitting
    expect(deleteButton).toBeDisabled();
    expect(cancelButton).toBeDisabled();
    expect(deleteButton).toHaveTextContent('Deleting...');

    // Resolve the promise
    resolveConfirm!();
    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('should show phase number when title is missing', () => {
    const phaseWithoutTitle: GamePhase = {
      ...mockPhase,
      title: '',
    };
    const onClose = vi.fn();
    const onConfirm = vi.fn();

    render(
      <DeletePhaseDialog
        isOpen={true}
        onClose={onClose}
        onConfirm={onConfirm}
        phase={phaseWithoutTitle}
      />
    );

    expect(screen.getByText(/Phase 1 \(common_room\)/)).toBeInTheDocument();
  });

  it('should not render when isOpen is false', () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn();

    const { container } = render(
      <DeletePhaseDialog
        isOpen={false}
        onClose={onClose}
        onConfirm={onConfirm}
        phase={mockPhase}
      />
    );

    // Modal should not render content when closed
    expect(screen.queryByText('Delete Phase')).not.toBeInTheDocument();
  });
});
