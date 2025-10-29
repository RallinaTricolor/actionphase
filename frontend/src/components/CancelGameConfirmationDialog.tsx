import { useState } from 'react';
import { Modal } from './Modal';
import { Button } from './ui';

interface CancelGameConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  gameTitle: string;
}

/**
 * CancelGameConfirmationDialog - Confirmation dialog for cancelling a game
 *
 * Cancelling a game:
 * - Permanently archives the game
 * - Cannot be undone or resumed
 * - Only available during setup/recruitment states
 */
export function CancelGameConfirmationDialog({
  isOpen,
  onClose,
  onConfirm,
  gameTitle,
}: CancelGameConfirmationDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConfirm = async () => {
    try {
      setIsSubmitting(true);
      await onConfirm();
      onClose();
    } catch (error) {
      // Error handling is done by the parent component
      console.error('Failed to cancel game:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Cancel Game">
      <div className="space-y-4">
        {/* Warning message */}
        <div className="bg-semantic-error/10 border border-semantic-error rounded-lg p-4">
          <h3 className="font-semibold text-content-primary mb-2">
            ⚠️ Permanent Action
          </h3>
          <p className="text-content-secondary text-sm">
            Cancelling this game will:
          </p>
          <ul className="list-disc list-inside text-content-secondary text-sm mt-2 space-y-1">
            <li>Permanently archive the game</li>
            <li>Prevent any further gameplay</li>
            <li>Mark the game as cancelled (cannot be undone)</li>
          </ul>
        </div>

        {/* Game info */}
        <div>
          <p className="text-content-secondary text-sm mb-2">
            You are about to cancel:
          </p>
          <p className="font-semibold text-content-primary">
            {gameTitle}
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3 justify-end pt-4">
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Keep Game
          </Button>
          <Button
            variant="danger"
            onClick={handleConfirm}
            disabled={isSubmitting}
            loading={isSubmitting}
          >
            {isSubmitting ? 'Cancelling...' : 'Cancel Game'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
