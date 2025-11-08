import { useState } from 'react';
import { Button, Card, CardHeader, Alert } from './ui';
import { CreateDeadlineModal } from './CreateDeadlineModal';
import { EditDeadlineModal } from './EditDeadlineModal';
import { DeadlineList } from './DeadlineList';
import { useDeadlines } from '../hooks/useDeadlines';
import type { Deadline } from '../types/deadlines';
import { logger } from '@/services/LoggingService';

export interface DeadlinesTabContentProps {
  gameId: number;
  isGM: boolean;
}

/**
 * DeadlinesTabContent - Complete deadlines management interface for game details page
 *
 * Features:
 * - Lists all deadlines for the game
 * - GM can create, edit, and delete deadlines
 * - Players can view deadlines
 * - Real-time countdowns
 *
 * @example
 * ```tsx
 * <DeadlinesTabContent gameId={gameId} isGM={isGM} />
 * ```
 */
export function DeadlinesTabContent({ gameId, isGM }: DeadlinesTabContentProps) {
  const {
    deadlines,
    isLoading,
    createDeadlineMutation,
    updateDeadlineMutation,
    deleteDeadlineMutation,
  } = useDeadlines(gameId);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedDeadline, setSelectedDeadline] = useState<Deadline | null>(null);

  const handleCreate = async (data: { title: string; description: string; deadline: string }) => {
    try {
      await createDeadlineMutation.mutateAsync(data);
      setShowCreateModal(false);
    } catch (error) {
      // Error is handled by the mutation
      logger.error('Failed to create deadline', { error, gameId, title: data.title });
    }
  };

  const handleEdit = (deadline: Deadline) => {
    setSelectedDeadline(deadline);
    setShowEditModal(true);
  };

  const handleUpdate = async (deadlineId: number, data: { title: string; description: string; deadline: string }) => {
    try {
      await updateDeadlineMutation.mutateAsync({ deadlineId, data });
      setShowEditModal(false);
      setSelectedDeadline(null);
    } catch (error) {
      // Error is handled by the mutation
      logger.error('Failed to update deadline', { error, gameId, deadlineId, title: data.title });
    }
  };

  const handleDelete = async (deadlineId: number) => {
    try {
      await deleteDeadlineMutation.mutateAsync(deadlineId);
    } catch (error) {
      // Error is handled by the mutation
      logger.error('Failed to delete deadline', { error, gameId, deadlineId });
    }
  };

  const handleExtend = async (deadlineId: number, hours: number) => {
    try {
      const deadline = deadlines.find(d => d.id === deadlineId);
      if (!deadline?.deadline) return;

      // Calculate new deadline by adding hours to current deadline
      const currentDate = new Date(deadline.deadline);
      const newDate = new Date(currentDate.getTime() + hours * 60 * 60 * 1000);

      await updateDeadlineMutation.mutateAsync({
        deadlineId,
        data: {
          title: deadline.title,
          description: deadline.description || '',
          deadline: newDate.toISOString(),
        },
      });
    } catch (error) {
      // Error is handled by the mutation
      logger.error('Failed to extend deadline', { error, gameId, deadlineId, hours });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <Card variant="default" padding="md">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-content-primary">Deadlines</h2>
              <p className="text-sm text-content-secondary mt-1">
                {isGM
                  ? 'Manage important deadlines for your game'
                  : 'View upcoming deadlines for this game'}
              </p>
            </div>

            {isGM && (
              <Button
                variant="primary"
                onClick={() => setShowCreateModal(true)}
                disabled={createDeadlineMutation.isPending}
              >
                Add Deadline
              </Button>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* Error Messages */}
      {createDeadlineMutation.isError && (
        <Alert variant="danger" title="Error Creating Deadline" dismissible>
          {createDeadlineMutation.error?.message || 'Failed to create deadline'}
        </Alert>
      )}

      {updateDeadlineMutation.isError && (
        <Alert variant="danger" title="Error Updating Deadline" dismissible>
          {updateDeadlineMutation.error?.message || 'Failed to update deadline'}
        </Alert>
      )}

      {deleteDeadlineMutation.isError && (
        <Alert variant="danger" title="Error Deleting Deadline" dismissible>
          {deleteDeadlineMutation.error?.message || 'Failed to delete deadline'}
        </Alert>
      )}

      {/* Deadlines List */}
      <DeadlineList
        deadlines={deadlines}
        isLoading={isLoading}
        onEdit={isGM ? handleEdit : undefined}
        onDelete={isGM ? handleDelete : undefined}
        onExtend={isGM ? handleExtend : undefined}
        showActions={isGM}
        emptyMessage={
          isGM
            ? 'No deadlines yet. Click "Add Deadline" to create one.'
            : 'No deadlines for this game yet.'
        }
      />

      {/* Create Deadline Modal */}
      <CreateDeadlineModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleCreate}
        isLoading={createDeadlineMutation.isPending}
        error={createDeadlineMutation.error?.message}
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
        isLoading={updateDeadlineMutation.isPending}
        error={updateDeadlineMutation.error?.message}
      />
    </div>
  );
}
