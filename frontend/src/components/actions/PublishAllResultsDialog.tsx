import { Modal } from '@/components/common/modals/Modal';
import { Alert, Button } from '@/components/ui';
import { usePhaseSheetDraftConflicts } from '@/hooks/useConflictingSheetDrafts';

interface PublishAllResultsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  gameId: number;
  phaseId: number | undefined;
  /** Draft results that will go out (chain heads; a chain counts once). */
  count: number;
  isPublishing?: boolean;
}

/**
 * The confirmation for Publish all, with the warning when a character's sheet
 * updates are spread over more than one of the drafts.
 */
export function PublishAllResultsDialog({ isOpen, onClose, onConfirm, gameId, phaseId, count, isPublishing = false }: PublishAllResultsDialogProps) {
  // Gated on the dialog being open: ungated, it fans out one draft-count
  // request per unpublished result, for a warning only this dialog shows.
  const { hasConflict, affectedCharacterCount } = usePhaseSheetDraftConflicts(gameId, phaseId, isOpen);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Publish All Results?">
      <p className="text-sm text-content-secondary mb-4">
        This will publish {count} {count === 1 ? 'result' : 'results'} and make {count === 1 ? 'it' : 'them'} visible to players. This action cannot be undone.
      </p>
      {/* Publishing in bulk applies every conflicting result in one
          transaction, so a clobber here is certain rather than possible. */}
      {hasConflict && (
        <Alert variant="danger" className="mb-4" data-testid="publish-all-sheet-conflict-warning">
          {affectedCharacterCount === 1
            ? 'One character has staged sheet updates on more than one of these results.'
            : `${affectedCharacterCount} characters have staged sheet updates on more than one of these results.`}{' '}
          Each result stores a complete snapshot of the character sheet, so publishing them together will overwrite one set of changes with
          another. Consolidate each character&apos;s sheet updates into a single result first.
        </Alert>
      )}
      <div className="flex justify-end space-x-3">
        <Button variant="ghost" onClick={onClose} disabled={isPublishing}>
          Cancel
        </Button>
        <Button variant="primary" onClick={onConfirm} disabled={isPublishing} className="bg-semantic-success hover:bg-semantic-success-hover">
          {isPublishing ? 'Publishing...' : 'Confirm & Publish'}
        </Button>
      </div>
    </Modal>
  );
}
