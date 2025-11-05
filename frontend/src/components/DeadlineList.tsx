import { useState, useMemo } from 'react';
import { TrashIcon, PencilIcon, ClockIcon } from '@heroicons/react/24/outline';
import { Card, CardHeader, CardBody, Button, Modal } from './ui';
import { DeadlineTimer } from './DeadlineTimer';
import type { Deadline } from '../types/deadlines';

export interface DeadlineListProps {
  deadlines: Deadline[];
  isLoading?: boolean;
  onEdit?: (deadline: Deadline) => void;
  onDelete?: (deadlineId: number) => void;
  onExtend?: (deadlineId: number, hours: number) => void;
  showActions?: boolean;
  emptyMessage?: string;
}

/**
 * DeadlineList - Displays a list of deadlines with actions
 *
 * Features:
 * - Shows deadline title, description, and time remaining
 * - Edit and delete actions (optional)
 * - Empty state message
 * - Loading state
 * - Confirmation before delete
 *
 * @example
 * ```tsx
 * <DeadlineList
 *   deadlines={deadlines}
 *   isLoading={isLoading}
 *   onEdit={handleEdit}
 *   onDelete={handleDelete}
 *   showActions={isGM}
 * />
 * ```
 */
export function DeadlineList({
  deadlines,
  isLoading = false,
  onEdit,
  onDelete,
  onExtend,
  showActions = true,
  emptyMessage = 'No deadlines yet.',
}: DeadlineListProps) {
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deadlineToDelete, setDeadlineToDelete] = useState<Deadline | null>(null);
  const [extendingId, setExtendingId] = useState<number | null>(null);
  const [extendHours, setExtendHours] = useState<number>(24);

  // Separate active and expired deadlines
  const { activeDeadlines, expiredDeadlines } = useMemo(() => {
    const now = new Date();
    const active: Deadline[] = [];
    const expired: Deadline[] = [];

    deadlines.forEach((deadline) => {
      if (!deadline.deadline) {
        active.push(deadline);
      } else {
        const deadlineDate = new Date(deadline.deadline);
        if (deadlineDate > now) {
          active.push(deadline);
        } else {
          expired.push(deadline);
        }
      }
    });

    // Sort active by soonest first
    active.sort((a, b) => {
      if (!a.deadline || !b.deadline) return 0;
      return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
    });

    // Sort expired by most recent first
    expired.sort((a, b) => {
      if (!a.deadline || !b.deadline) return 0;
      return new Date(b.deadline).getTime() - new Date(a.deadline).getTime();
    });

    return { activeDeadlines: active, expiredDeadlines: expired };
  }, [deadlines]);

  const handleDeleteClick = (deadline: Deadline) => {
    setDeadlineToDelete(deadline);
  };

  const handleConfirmDelete = () => {
    if (deadlineToDelete) {
      setDeletingId(deadlineToDelete.id);
      onDelete?.(deadlineToDelete.id);
      setDeadlineToDelete(null);
    }
  };

  const handleCancelDelete = () => {
    setDeadlineToDelete(null);
  };

  const handleExtendClick = (deadlineId: number) => {
    setExtendingId(deadlineId);
  };

  const handleConfirmExtend = () => {
    if (extendingId !== null) {
      onExtend?.(extendingId, extendHours);
      setExtendingId(null);
      setExtendHours(24); // Reset to default
    }
  };

  const handleCancelExtend = () => {
    setExtendingId(null);
    setExtendHours(24);
  };

  if (isLoading) {
    return (
      <Card variant="default" padding="md">
        <CardBody>
          <div className="flex items-center justify-center py-8">
            <div className="text-content-secondary">Loading deadlines...</div>
          </div>
        </CardBody>
      </Card>
    );
  }

  if (deadlines.length === 0) {
    return (
      <Card variant="default" padding="md">
        <CardBody>
          <div className="flex items-center justify-center py-8">
            <div className="text-content-secondary">{emptyMessage}</div>
          </div>
        </CardBody>
      </Card>
    );
  }

  const renderDeadline = (deadline: Deadline, isExpired: boolean = false) => (
    <Card key={deadline.id} variant="bordered" padding="md" className={isExpired ? 'opacity-60' : ''}>
      <CardBody>
        <div className="flex items-start justify-between gap-4">
          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <h3 className="text-lg font-semibold text-content-primary truncate">
                {deadline.title}
              </h3>
              {deadline.deadline && (
                <DeadlineTimer deadline={deadline.deadline} />
              )}
            </div>

            {deadline.description && (
              <p className="text-sm text-content-secondary whitespace-pre-wrap">
                {deadline.description}
              </p>
            )}

            {deadline.deadline && (
              <p className="mt-2 text-xs text-content-tertiary">
                Due: {new Date(deadline.deadline).toLocaleString()}
              </p>
            )}
          </div>

          {/* Actions */}
          {showActions && (onEdit || onDelete || onExtend) && (
            <div className="flex items-center gap-2 flex-shrink-0">
              {onEdit && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onEdit(deadline)}
                  disabled={deletingId === deadline.id}
                  icon={<PencilIcon className="h-4 w-4" />}
                  aria-label="Edit deadline"
                >
                  Edit
                </Button>
              )}

              {onExtend && !isExpired && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleExtendClick(deadline.id)}
                  disabled={deletingId === deadline.id}
                  icon={<ClockIcon className="h-4 w-4" />}
                  aria-label="Extend deadline"
                >
                  Extend
                </Button>
              )}

              {onDelete && (
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => handleDeleteClick(deadline)}
                  loading={deletingId === deadline.id}
                  disabled={deletingId === deadline.id}
                  icon={<TrashIcon className="h-4 w-4" />}
                  aria-label="Delete deadline"
                >
                  Delete
                </Button>
              )}
            </div>
          )}
        </div>
      </CardBody>
    </Card>
  );

  return (
    <>
      <div className="space-y-6">
        {/* Active Deadlines Section */}
        {activeDeadlines.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold text-content-primary mb-3">
              Active Deadlines ({activeDeadlines.length})
            </h2>
            <div className="space-y-4">
              {activeDeadlines.map((deadline) => renderDeadline(deadline, false))}
            </div>
          </div>
        )}

        {/* Expired Deadlines Section */}
        {expiredDeadlines.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold text-content-secondary mb-3">
              Expired Deadlines ({expiredDeadlines.length})
            </h2>
            <div className="space-y-4">
              {expiredDeadlines.map((deadline) => renderDeadline(deadline, true))}
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deadlineToDelete && (
        <Modal
          isOpen={true}
          onClose={handleCancelDelete}
          title="Delete Deadline"
          size="sm"
          footer={
            <>
              <Button variant="secondary" onClick={handleCancelDelete}>
                Cancel
              </Button>
              <Button variant="danger" onClick={handleConfirmDelete}>
                Delete
              </Button>
            </>
          }
        >
          <p className="text-content-primary">
            Are you sure you want to delete "{deadlineToDelete.title}"?
          </p>
          <p className="mt-2 text-sm text-content-secondary">
            This action cannot be undone.
          </p>
        </Modal>
      )}

      {/* Extend Deadline Modal */}
      {extendingId !== null && (
        <Modal
          isOpen={true}
          onClose={handleCancelExtend}
          title="Extend Deadline"
          size="sm"
          footer={
            <>
              <Button variant="secondary" onClick={handleCancelExtend}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleConfirmExtend}>
                Extend Deadline
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <p className="text-content-primary">
              How many hours would you like to extend this deadline?
            </p>

            <div className="flex flex-wrap gap-2">
              <Button
                variant={extendHours === 24 ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setExtendHours(24)}
              >
                24 hours
              </Button>
              <Button
                variant={extendHours === 48 ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setExtendHours(48)}
              >
                48 hours
              </Button>
              <Button
                variant={extendHours === 72 ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setExtendHours(72)}
              >
                72 hours
              </Button>
              <Button
                variant={extendHours === 168 ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setExtendHours(168)}
              >
                1 week
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="custom-hours" className="text-sm text-content-secondary">
                Custom hours:
              </label>
              <input
                id="custom-hours"
                type="number"
                min="1"
                max="720"
                value={extendHours}
                onChange={(e) => setExtendHours(Math.max(1, Math.min(720, parseInt(e.target.value) || 24)))}
                className="w-24 px-3 py-2 border border-border-primary rounded bg-bg-secondary text-content-primary focus:outline-none focus:ring-2 focus:ring-interactive-primary"
              />
            </div>

            {(() => {
              const currentDeadline = deadlines.find(d => d.id === extendingId);
              if (currentDeadline?.deadline) {
                const currentDate = new Date(currentDeadline.deadline);
                const newDate = new Date(currentDate.getTime() + extendHours * 60 * 60 * 1000);
                return (
                  <div className="mt-4 p-3 bg-bg-tertiary border border-border-primary rounded">
                    <p className="text-xs text-content-tertiary mb-1">Current deadline:</p>
                    <p className="text-sm text-content-secondary mb-2">
                      {currentDate.toLocaleString()}
                    </p>
                    <p className="text-xs text-content-tertiary mb-1">New deadline:</p>
                    <p className="text-sm text-content-primary font-medium">
                      {newDate.toLocaleString()}
                    </p>
                  </div>
                );
              }
              return null;
            })()}
          </div>
        </Modal>
      )}
    </>
  );
}
