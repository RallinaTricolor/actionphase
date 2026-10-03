import { Button } from '@/components/ui';

interface ConfirmRemovalProps {
  /** What removing it means for stored data, e.g. "3 characters have entries here…". */
  message: string;
  onRemove: () => void;
  onKeep: () => void;
  confirmLabel?: string;
  keepLabel?: string;
}

/** Inline confirmation before a change that hides stored data: removing a tab or field, or resetting the layout. */
export function ConfirmRemoval({ message, onRemove, onKeep, confirmLabel = 'Remove', keepLabel = 'Keep' }: ConfirmRemovalProps) {
  return (
    <div
      role="alertdialog"
      aria-label={`Confirm: ${confirmLabel}`}
      className="rounded-md border border-semantic-warning bg-semantic-warning-subtle p-3 space-y-2"
    >
      <p className="text-sm text-content-primary">{message}</p>
      <div className="flex gap-2">
        <Button type="button" variant="danger" size="sm" onClick={onRemove}>
          {confirmLabel}
        </Button>
        <Button type="button" variant="secondary" size="sm" onClick={onKeep}>
          {keepLabel}
        </Button>
      </div>
    </div>
  );
}

