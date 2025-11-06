import { Modal } from './Modal';
import { Button, Badge, Alert } from './ui';
import { useDraftCharacterUpdates } from '../hooks';

interface PublishResultConfirmationDialogProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  gameId: number;
  actionResultId: number;
  isPublishing?: boolean;
}

export const PublishResultConfirmationDialog: React.FC<PublishResultConfirmationDialogProps> = ({
  isOpen,
  onConfirm,
  onCancel,
  gameId,
  actionResultId,
  isPublishing = false,
}) => {
  const { data: drafts } = useDraftCharacterUpdates(gameId, actionResultId);
  const draftCount = drafts?.length || 0;

  return (
    <Modal isOpen={isOpen} onClose={onCancel} title="Publish Action Result?">
      <div className="space-y-4">
        <p className="text-content-primary">
          This will publish the action result and make it visible to the player.
        </p>

        {draftCount > 0 && (
          <Alert variant="warning" title={`This will also publish ${draftCount} character sheet update${draftCount !== 1 ? 's' : ''}`}>
            <ul className="list-disc list-inside space-y-1 mt-2">
              {drafts?.map(draft => (
                <li key={draft.id} className="text-sm">
                  <Badge variant="primary" className="mr-1">
                    {draft.module_type}
                  </Badge>
                  <span className="font-medium">{draft.field_name}</span>
                </li>
              ))}
            </ul>
          </Alert>
        )}

        <p className="text-sm text-content-secondary">
          This action cannot be undone. The result will be visible immediately.
        </p>

        <div className="flex justify-end space-x-3 pt-4">
          <Button
            variant="secondary"
            onClick={onCancel}
            disabled={isPublishing}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={onConfirm}
            disabled={isPublishing}
          >
            {isPublishing ? 'Publishing...' : 'Publish'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
