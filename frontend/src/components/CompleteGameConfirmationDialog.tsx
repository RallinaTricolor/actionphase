import { useState } from 'react';
import { Modal } from './Modal';
import { Button, Input } from './ui';
import { logger } from '@/services/LoggingService';

interface CompleteGameConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  gameTitle: string;
}

/**
 * CompleteGameConfirmationDialog - Confirmation dialog for completing a game
 *
 * Requires the GM to type "completed" to prevent accidental game completion.
 * Once a game is completed:
 * - It becomes a read-only public archive
 * - No new content can be created
 * - Anyone can view the game's history
 */
export function CompleteGameConfirmationDialog({
  isOpen,
  onClose,
  onConfirm,
  gameTitle,
}: CompleteGameConfirmationDialogProps) {
  const [confirmText, setConfirmText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isConfirmEnabled = confirmText.toLowerCase() === 'completed';

  const handleConfirm = async () => {
    if (!isConfirmEnabled) return;

    try {
      setIsSubmitting(true);
      await onConfirm();
      onClose();
    } catch (error) {
      // Error handling is done by the parent component
      logger.error('Failed to complete game', { error, gameTitle });
    } finally {
      setIsSubmitting(false);
      setConfirmText(''); // Reset on close
    }
  };

  const handleClose = () => {
    setConfirmText('');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Complete Game">
      <div className="space-y-4">
        {/* Warning message */}
        <div className="bg-semantic-warning/10 border border-semantic-warning rounded-lg p-4">
          <h3 className="font-semibold text-content-primary mb-2">
            ⚠️ This action cannot be undone
          </h3>
          <p className="text-content-secondary text-sm">
            Completing this game will:
          </p>
          <ul className="list-disc list-inside text-content-secondary text-sm mt-2 space-y-1">
            <li>Make the game read-only (no new posts, actions, or content)</li>
            <li>Make it publicly viewable as an archive (anyone can read it)</li>
            <li>Prevent any further state changes</li>
          </ul>
        </div>

        {/* Game info */}
        <div>
          <p className="text-content-secondary text-sm mb-2">
            You are about to complete:
          </p>
          <p className="font-semibold text-content-primary">
            {gameTitle}
          </p>
        </div>

        {/* Confirmation input */}
        <div>
          <Input
            label="Type 'completed' to confirm"
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="completed"
            autoFocus
            disabled={isSubmitting}
          />
        </div>

        {/* Action buttons */}
        <div className="flex gap-3 justify-end pt-4">
          <Button
            variant="secondary"
            onClick={handleClose}
            disabled={isSubmitting}
            data-testid="complete-game-cancel-button"
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleConfirm}
            disabled={!isConfirmEnabled || isSubmitting}
            loading={isSubmitting}
            className="bg-semantic-success hover:bg-semantic-success-hover text-white"
            data-testid="complete-game-confirm-button"
          >
            {isSubmitting ? 'Completing...' : 'Complete Game'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
