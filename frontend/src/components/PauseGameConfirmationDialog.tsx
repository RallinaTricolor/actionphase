import { useState } from 'react';
import { Modal } from './Modal';
import { Button } from './ui';

interface PauseGameConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  gameTitle: string;
}

/**
 * PauseGameConfirmationDialog - Confirmation dialog for pausing a game
 *
 * Pausing a game:
 * - Temporarily stops gameplay
 * - Can be resumed at any time
 * - Useful for breaks or waiting for players
 */
export function PauseGameConfirmationDialog({
  isOpen,
  onClose,
  onConfirm,
  gameTitle,
}: PauseGameConfirmationDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConfirm = async () => {
    try {
      setIsSubmitting(true);
      await onConfirm();
      onClose();
    } catch (error) {
      // Error handling is done by the parent component
      console.error('Failed to pause game:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Pause Game">
      <div className="space-y-4">
        {/* Info message */}
        <div className="bg-semantic-warning/10 border border-semantic-warning rounded-lg p-4">
          <h3 className="font-semibold text-content-primary mb-2">
            ⏸️ Pause Gameplay
          </h3>
          <p className="text-content-secondary text-sm">
            Pausing this game will:
          </p>
          <ul className="list-disc list-inside text-content-secondary text-sm mt-2 space-y-1">
            <li>Temporarily stop active gameplay</li>
            <li>Prevent phase transitions and new actions</li>
            <li>Allow you to resume at any time</li>
          </ul>
        </div>

        {/* Game info */}
        <div>
          <p className="text-content-secondary text-sm mb-2">
            You are about to pause:
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
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleConfirm}
            disabled={isSubmitting}
            loading={isSubmitting}
            className="bg-semantic-warning hover:bg-semantic-warning-hover text-white"
          >
            {isSubmitting ? 'Pausing...' : 'Pause Game'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
