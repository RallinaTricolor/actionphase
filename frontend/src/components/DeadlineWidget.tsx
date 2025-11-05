import { useState, useMemo } from 'react';
import { ClockIcon, PlusIcon, TrashIcon, PencilIcon } from '@heroicons/react/24/outline';
import { Card, CardBody, Button, Modal } from './ui';
import { DeadlineTimer } from './DeadlineTimer';
import { CreateDeadlineModal } from './CreateDeadlineModal';
import { EditDeadlineModal } from './EditDeadlineModal';
import type { Deadline } from '../types/deadlines';

export interface DeadlineWidgetProps {
  deadlines: Deadline[];
  isLoading?: boolean;
  isGM?: boolean;
  onCreateDeadline: (data: { title: string; description: string; deadline: string }) => Promise<void>;
  onUpdateDeadline: (deadlineId: number, data: { title: string; description: string; deadline: string }) => Promise<void>;
  onDeleteDeadline: (deadlineId: number) => Promise<void>;
  onExtendDeadline: (deadlineId: number, hours: number) => Promise<void>;
}

/**
 * DeadlineWidget - Expandable floating widget for deadline management
 *
 * Features:
 * - Shows all game deadlines (active and expired)
 * - Full deadline management (create, edit, delete, extend) for GMs
 * - Collapsible to minimize space
 * - Separate active/expired sections
 * - Real-time countdown timers
 *
 * @example
 * ```tsx
 * <DeadlineWidget
 *   deadlines={deadlines}
 *   isLoading={isLoading}
 *   isGM={isGM}
 *   onCreateDeadline={handleCreate}
 *   onUpdateDeadline={handleUpdate}
 *   onDeleteDeadline={handleDelete}
 *   onExtendDeadline={handleExtend}
 * />
 * ```
 */
export function DeadlineWidget({
  deadlines,
  isLoading = false,
  isGM = false,
  onCreateDeadline,
  onUpdateDeadline,
  onDeleteDeadline,
  onExtendDeadline,
}: DeadlineWidgetProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedDeadline, setSelectedDeadline] = useState<Deadline | null>(null);
  const [deadlineToDelete, setDeadlineToDelete] = useState<Deadline | null>(null);
  const [extendingId, setExtendingId] = useState<number | null>(null);
  const [extendHours, setExtendHours] = useState<number>(24);
  const [deletingId, setDeletingId] = useState<number | null>(null);

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

  const handleEdit = (deadline: Deadline) => {
    setSelectedDeadline(deadline);
    setShowEditModal(true);
  };

  const handleUpdate = async (deadlineId: number, data: { title: string; description: string; deadline: string }) => {
    await onUpdateDeadline(deadlineId, data);
    setShowEditModal(false);
    setSelectedDeadline(null);
  };

  const handleDeleteClick = (deadline: Deadline) => {
    setDeadlineToDelete(deadline);
  };

  const handleConfirmDelete = async () => {
    if (deadlineToDelete) {
      setDeletingId(deadlineToDelete.id);
      await onDeleteDeadline(deadlineToDelete.id);
      setDeadlineToDelete(null);
      setDeletingId(null);
    }
  };

  const handleCancelDelete = () => {
    setDeadlineToDelete(null);
  };

  const handleExtendClick = (deadlineId: number) => {
    setExtendingId(deadlineId);
  };

  const handleConfirmExtend = async () => {
    if (extendingId !== null) {
      await onExtendDeadline(extendingId, extendHours);
      setExtendingId(null);
      setExtendHours(24);
    }
  };

  const handleCancelExtend = () => {
    setExtendingId(null);
    setExtendHours(24);
  };

  const handleCreate = async (data: { title: string; description: string; deadline: string }) => {
    await onCreateDeadline(data);
    setShowCreateModal(false);
  };

  // Don't show widget if no deadlines and user is not GM
  if (!isLoading && deadlines.length === 0 && !isGM) {
    return null;
  }

  if (isLoading) {
    return (
      <Card variant="elevated" padding="sm" className="mb-4">
        <CardBody>
          <div className="flex items-center justify-center py-4">
            <div className="text-content-secondary">Loading deadlines...</div>
          </div>
        </CardBody>
      </Card>
    );
  }

  return (
    <>
      <Card variant="elevated" padding="sm" className="mb-4">
        <CardBody>
          <div className="space-y-3">
            {/* Header */}
            <div className="flex items-center justify-between gap-2">
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex items-center gap-2 text-content-primary font-semibold hover:opacity-80 transition-opacity min-w-0 flex-1 sm:flex-initial"
              >
                <ClockIcon className="h-5 w-5 flex-shrink-0" />
                <span className="truncate">
                  Deadlines
                  {deadlines.length > 0 && (
                    <span className="ml-2 text-sm font-normal text-content-secondary hidden sm:inline">
                      ({activeDeadlines.length} active{expiredDeadlines.length > 0 ? `, ${expiredDeadlines.length} expired` : ''})
                    </span>
                  )}
                </span>
                <svg
                  className={`h-4 w-4 flex-shrink-0 transition-transform duration-300 ease-in-out ${isExpanded ? 'rotate-180' : 'rotate-0'}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {isGM && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setShowCreateModal(true)}
                  icon={<PlusIcon className="h-4 w-4" />}
                  className="flex-shrink-0"
                >
                  <span className="hidden sm:inline">Add Deadline</span>
                  <span className="sm:hidden">Add</span>
                </Button>
              )}
            </div>

            {/* Deadline List */}
            <div
              className={`space-y-4 overflow-hidden transition-all duration-300 ease-in-out ${
                isExpanded ? 'max-h-[2000px] opacity-100 mt-3' : 'max-h-0 opacity-0 mt-0'
              }`}
            >
                {deadlines.length === 0 ? (
                  <div className="text-sm text-content-secondary py-2">
                    {isGM ? 'No deadlines yet. Click "Add Deadline" to create one.' : 'No deadlines for this game yet.'}
                  </div>
                ) : (
                  <>
                    {/* Active Deadlines */}
                    {activeDeadlines.length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold text-content-primary mb-2">
                          Active ({activeDeadlines.length})
                        </h3>
                        <div className="space-y-2">
                          {activeDeadlines.map((deadline) => (
                            <div
                              key={deadline.id}
                              className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-3 p-2 rounded border border-border-primary bg-bg-secondary"
                            >
                              <div className="flex-1 min-w-0">
                                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 mb-1">
                                  <h4 className="text-sm font-medium text-content-primary truncate">
                                    {deadline.title}
                                  </h4>
                                  {deadline.deadline && (
                                    <DeadlineTimer deadline={deadline.deadline} className="flex-shrink-0" />
                                  )}
                                </div>
                                {deadline.description && (
                                  <p className="text-xs text-content-secondary line-clamp-2">
                                    {deadline.description}
                                  </p>
                                )}
                                {deadline.deadline && (
                                  <p className="text-xs text-content-tertiary mt-1">
                                    Due: {new Date(deadline.deadline).toLocaleString()}
                                  </p>
                                )}
                              </div>

                              {/* GM Actions */}
                              {isGM && (
                                <div className="flex items-center gap-1 flex-shrink-0 self-end sm:self-start">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleEdit(deadline)}
                                    disabled={deletingId === deadline.id}
                                    icon={<PencilIcon className="h-3 w-3" />}
                                    aria-label="Edit deadline"
                                  />
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => handleExtendClick(deadline.id)}
                                    disabled={deletingId === deadline.id}
                                    icon={<ClockIcon className="h-3 w-3" />}
                                    aria-label="Extend deadline"
                                  />
                                  <Button
                                    variant="danger"
                                    size="sm"
                                    onClick={() => handleDeleteClick(deadline)}
                                    loading={deletingId === deadline.id}
                                    disabled={deletingId === deadline.id}
                                    icon={<TrashIcon className="h-3 w-3" />}
                                    aria-label="Delete deadline"
                                  />
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Expired Deadlines */}
                    {expiredDeadlines.length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold text-content-secondary mb-2">
                          Expired ({expiredDeadlines.length})
                        </h3>
                        <div className="space-y-2">
                          {expiredDeadlines.map((deadline) => (
                            <div
                              key={deadline.id}
                              className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-3 p-2 rounded border border-border-primary bg-bg-secondary opacity-60"
                            >
                              <div className="flex-1 min-w-0">
                                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 mb-1">
                                  <h4 className="text-sm font-medium text-content-primary truncate">
                                    {deadline.title}
                                  </h4>
                                  {deadline.deadline && (
                                    <DeadlineTimer deadline={deadline.deadline} className="flex-shrink-0" />
                                  )}
                                </div>
                                {deadline.description && (
                                  <p className="text-xs text-content-secondary line-clamp-2">
                                    {deadline.description}
                                  </p>
                                )}
                                {deadline.deadline && (
                                  <p className="text-xs text-content-tertiary mt-1">
                                    Due: {new Date(deadline.deadline).toLocaleString()}
                                  </p>
                                )}
                              </div>

                              {/* GM Actions */}
                              {isGM && (
                                <div className="flex items-center gap-1 flex-shrink-0 self-end sm:self-start">
                                  <Button
                                    variant="danger"
                                    size="sm"
                                    onClick={() => handleDeleteClick(deadline)}
                                    loading={deletingId === deadline.id}
                                    disabled={deletingId === deadline.id}
                                    icon={<TrashIcon className="h-3 w-3" />}
                                    aria-label="Delete deadline"
                                  />
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
          </div>
        </CardBody>
      </Card>

      {/* Create Deadline Modal */}
      <CreateDeadlineModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleCreate}
        isLoading={false}
      />

      {/* Edit Deadline Modal */}
      <EditDeadlineModal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setSelectedDeadline(null);
        }}
        onSubmit={handleUpdate}
        deadline={selectedDeadline}
        isLoading={false}
      />

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
