import { useState } from 'react';
import type { GameApplication } from '../types/games';
import { APPLICATION_STATUS_LABELS, APPLICATION_STATUS_COLORS } from '../types/games';

interface GameApplicationCardProps {
  application: GameApplication;
  isGM?: boolean;
  onApprove?: (applicationId: number) => Promise<void>;
  onReject?: (applicationId: number) => Promise<void>;
}

export const GameApplicationCard = ({
  application,
  isGM = false,
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

    if (!confirm('Are you sure you want to reject this application?')) return;

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
    <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            {application.username || `User ${application.user_id}`}
          </h3>
          <p className="text-sm text-gray-500 capitalize">
            Applying as {application.role}
          </p>
          {application.email && (
            <p className="text-sm text-gray-500">{application.email}</p>
          )}
        </div>
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${APPLICATION_STATUS_COLORS[application.status]}`}>
          {APPLICATION_STATUS_LABELS[application.status]}
        </span>
      </div>

      {application.message && (
        <div className="mb-4">
          <h4 className="font-medium text-gray-900 mb-2">Application Message:</h4>
          <p className="text-gray-700 bg-gray-50 p-3 rounded-lg text-sm leading-relaxed">
            "{application.message}"
          </p>
        </div>
      )}

      <div className="flex justify-between items-center text-sm text-gray-500 mb-4">
        <span>Applied: {formatDate(application.applied_at)}</span>
        {application.reviewed_at && (
          <span>Reviewed: {formatDate(application.reviewed_at)}</span>
        )}
      </div>

      {isGM && application.status === 'pending' && onApprove && onReject && (
        <div className="flex gap-3 pt-4 border-t border-gray-100">
          <button
            onClick={handleApprove}
            disabled={actionLoading}
            className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {actionLoading ? 'Processing...' : 'Approve'}
          </button>
          <button
            onClick={handleReject}
            disabled={actionLoading}
            className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {actionLoading ? 'Processing...' : 'Reject'}
          </button>
        </div>
      )}
    </div>
  );
};
