import { ConfirmActionDialog } from '@/components/common/modals/ConfirmActionDialog';

interface DeleteGameConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  gameTitle: string;
}

/**
 * DeleteGameConfirmationDialog - Confirmation dialog for deleting a game.
 *
 * Deletion is allowed in any state and is a soft delete server-side: the game
 * disappears for everyone (lists, profiles, its own pages 404) but its data is
 * kept, so an operator can restore it. To the GM it is still final -- there is
 * no undo in the app -- hence the typed confirmation.
 *
 * Only offered to the primary GM (or an admin in admin mode).
 *
 * Dismissal is locked while the delete is in flight: on success the parent
 * navigates away, and a backdrop click mid-request would race that.
 */
export function DeleteGameConfirmationDialog({
  isOpen,
  onClose,
  onConfirm,
  gameTitle,
}: DeleteGameConfirmationDialogProps) {
  return (
    <ConfirmActionDialog
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title="Delete Game"
      headline="⚠️ This cannot be undone from the app"
      intro="Deleting this game will:"
      consequences={[
        'Remove it from the games list, the dashboard and every profile',
        'Remove access for all players, co-GMs and audience members',
        'Make all of its pages, posts and characters unreachable',
      ]}
      subjectLabel="You are about to delete:"
      subject={gameTitle}
      tone="danger"
      requireTypedConfirmation="delete"
      confirmLabel="Delete Game"
      confirmPendingLabel="Deleting..."
      confirmVariant="danger"
      confirmTestId="delete-game-confirm-button"
      cancelLabel="Keep Game"
      cancelTestId="delete-game-cancel-button"
      lockWhileSubmitting
    />
  );
}
