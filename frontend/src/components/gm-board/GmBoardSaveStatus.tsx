import { Badge, Button } from '@/components/ui';
import type { GmSaveStatus } from '@/hooks/useGmBoard';

interface GmBoardSaveStatusProps {
  status: GmSaveStatus;
  error: string | null;
  onRetry: () => void;
}

const LABELS: Record<Exclude<GmSaveStatus, 'error'>, string> = {
  saved: 'Saved',
  unsaved: 'Unsaved changes',
  saving: 'Saving…',
};

/** Whether the board's edits have reached the server. */
export function GmBoardSaveStatus({ status, error, onRetry }: GmBoardSaveStatusProps) {
  if (status === 'error') {
    return (
      <div className="flex items-center gap-2" data-testid="gm-board-save-status" role="status">
        <Badge variant="danger">Not saved{error ? `: ${error}` : ''}</Badge>
        <Button type="button" size="sm" variant="secondary" onClick={onRetry}>
          Try again
        </Button>
      </div>
    );
  }
  return (
    <div data-testid="gm-board-save-status" role="status">
      <Badge variant="neutral">{LABELS[status]}</Badge>
    </div>
  );
}
