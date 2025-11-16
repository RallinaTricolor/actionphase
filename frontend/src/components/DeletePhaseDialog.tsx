import { useState } from 'react';
import { Modal } from './Modal';
import { Button } from './ui';
import type { GamePhase } from '../types/phases';
import { logger } from '@/services/LoggingService';

interface DeletePhaseDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  phase: GamePhase;
}

/**
 * DeletePhaseDialog - Confirmation dialog for deleting a phase
 *
 * Deleting a phase:
 * - Only allowed if the phase has no associated content
 * - Cannot be undone
 * - Only available to the Game Master
 */
export function DeletePhaseDialog({
  isOpen,
  onClose,
  onConfirm,
  phase,
}: DeletePhaseDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    try {
      setIsSubmitting(true);
      setError(null);
      await onConfirm();
      onClose();
    } catch (_err) {
      // Extract error message from API response
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete phase';
      setError(errorMessage);
      logger.error('Failed to delete phase', { error: err, phaseId: phase.id, phaseNumber: phase.phase_number, phaseTitle: phase.title });
    } finally {
      setIsSubmitting(false);
    }
  };

  const phaseLabel = phase.title || `Phase ${phase.phase_number}`;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Delete Phase">
      <div className="space-y-4">
        {/* Warning message */}
        <div className="bg-semantic-warning/10 border border-semantic-warning rounded-lg p-4">
          <h3 className="font-semibold text-content-primary mb-2">
            ⚠️ Delete Phase
          </h3>
          <p className="text-content-secondary text-sm">
            This phase can only be deleted if it has no associated content (submissions, results, messages, polls, or threads).
          </p>
        </div>

        {/* Phase info */}
        <div>
          <p className="text-content-secondary text-sm mb-2">
            You are about to delete:
          </p>
          <p className="font-semibold text-content-primary">
            {phaseLabel} ({phase.phase_type})
          </p>
          {phase.description && (
            <p className="text-content-secondary text-sm mt-1">
              {phase.description}
            </p>
          )}
        </div>

        {/* Error message */}
        {error && (
          <div className="bg-semantic-error/10 border border-semantic-error rounded-lg p-4">
            <p className="text-semantic-error text-sm">{error}</p>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-3 justify-end pt-4">
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={isSubmitting}
            data-testid="delete-phase-cancel-button"
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={handleConfirm}
            disabled={isSubmitting}
            loading={isSubmitting}
            data-testid="delete-phase-confirm-button"
          >
            {isSubmitting ? 'Deleting...' : 'Delete Phase'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
