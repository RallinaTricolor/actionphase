import { useState } from 'react';
import type { GameApplication, GameState } from '../types/games';
import { APPLICATION_STATUS_LABELS, APPLICATION_STATUS_COLORS } from '../types/games';
import { Button } from './ui';

interface GameApplicationCardProps {
  application: GameApplication;
  isGM?: boolean;
  gameState?: GameState;
  onApprove?: (applicationId: number) => Promise<void>;
  onReject?: (applicationId: number) => Promise<void>;
}

export const GameApplicationCard = ({
  application,
  isGM = false,
  gameState,
  onApprove,
  onReject
}: GameApplicationCardProps) => {
  const [actionLoading, setActionLoading] = useState(false);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleApprove = async () => {
    if (!onApprove) return;

    try {
      setActionLoading(true);
      await onApprove(application.id);
    } catch (error) {
      console.error('Failed to approve application:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!onReject) return;

    if (!confirm('Are you sure you want to reject this application?')) {
      return;
    }

    try {
      setActionLoading(true);
      await onReject(application.id);
    } catch (error) {
      console.error('Failed to reject application:', error);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="surface-base border border-theme-default rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-semibold text-content-primary">
            {application.username || `User ${application.user_id}`}
          </h3>
          <p className="text-sm text-content-secondary capitalize">
            Applying as {application.role}
          </p>
          {application.email && (
            <p className="text-sm text-content-secondary">{application.email}</p>
          )}
        </div>
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${APPLICATION_STATUS_COLORS[application.status]}`}>
          {APPLICATION_STATUS_LABELS[application.status]}
        </span>
      </div>

      {application.message && (
        <div className="mb-4">
          <h4 className="font-medium text-content-primary mb-2">Application Message:</h4>
          <p className="text-content-primary surface-raised p-3 rounded-lg text-sm leading-relaxed">
            "{application.message}"
          </p>
        </div>
      )}

      <div className="flex justify-between items-center text-sm text-content-secondary mb-4">
        <span>Applied: {formatDate(application.applied_at)}</span>
        {application.reviewed_at && (
          <span>Reviewed: {formatDate(application.reviewed_at)}</span>
        )}
      </div>

      {isGM && gameState === 'recruitment' && onApprove && onReject && (
        <div className="flex justify-end gap-3 pt-4 border-t border-theme-default">
          {application.status === 'pending' && (
            <>
              <Button
                variant="danger"
                size="sm"
                onClick={handleReject}
                disabled={actionLoading}
              >
                {actionLoading ? 'Processing...' : 'Reject'}
              </Button>
              <Button
                variant="success"
                size="sm"
                onClick={handleApprove}
                disabled={actionLoading}
              >
                {actionLoading ? 'Processing...' : 'Approve'}
              </Button>
            </>
          )}
          {application.status === 'approved' && (
            <Button
              variant="danger"
              size="sm"
              onClick={handleReject}
              disabled={actionLoading}
            >
              {actionLoading ? 'Processing...' : 'Reject'}
            </Button>
          )}
          {application.status === 'rejected' && (
            <Button
              variant="success"
              size="sm"
              onClick={handleApprove}
              disabled={actionLoading}
            >
              {actionLoading ? 'Processing...' : 'Approve'}
            </Button>
          )}
        </div>
      )}
    </div>
  );
};
