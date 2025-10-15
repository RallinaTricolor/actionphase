import { useState, useEffect } from 'react';
import { apiClient } from '../lib/api';
import type { GameApplication, GameState } from '../types/games';
import { GameApplicationCard } from './GameApplicationCard';

interface GameApplicationsListProps {
  gameId: number;
  isGM?: boolean;
  gameState?: GameState;
}

export const GameApplicationsList = ({ gameId, isGM = false, gameState }: GameApplicationsListProps) => {
  const [applications, setApplications] = useState<GameApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isGM) {
      fetchApplications();
    }
  }, [gameId, isGM]);

  const fetchApplications = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getGameApplications(gameId);
      setApplications(response.data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load applications');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (applicationId: number) => {
    try {
      await apiClient.reviewGameApplication(gameId, applicationId, { action: 'approve' });
      await fetchApplications(); // Refresh the list
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to approve application');
    }
  };

  const handleReject = async (applicationId: number) => {
    try {
      await apiClient.reviewGameApplication(gameId, applicationId, { action: 'reject' });
      await fetchApplications(); // Refresh the list
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to reject application');
    }
  };

  if (!isGM) {
    return null;
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Applications</h2>
        <div className="flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-md p-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Applications</h2>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-600">Failed to load applications: {error}</p>
          <button
            onClick={fetchApplications}
            className="mt-3 bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded-lg text-sm transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const pendingApplications = applications.filter(app => app.status === 'pending');
  const reviewedApplications = applications.filter(app => app.status !== 'pending');

  return (
    <div className="bg-white rounded-lg shadow-md p-8">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Applications</h2>
        <div className="text-sm text-gray-500">
          {applications.length} total applications
        </div>
      </div>

      {applications.length === 0 ? (
        <div className="text-center py-8">
          <div className="text-gray-400 text-6xl mb-4">📋</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Applications Yet</h3>
          <p className="text-gray-500">Players haven't submitted applications for this game yet.</p>
        </div>
      ) : (
        <>
          {/* Pending Applications */}
          {pendingApplications.length > 0 && (
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                Pending Review
                <span className="ml-2 bg-yellow-100 text-yellow-800 text-sm font-medium px-2.5 py-0.5 rounded-full">
                  {pendingApplications.length}
                </span>
              </h3>
              <div className="space-y-4">
                {pendingApplications.map((application) => (
                  <GameApplicationCard
                    key={application.id}
                    application={application}
                    isGM={true}
                    gameState={gameState}
                    onApprove={handleApprove}
                    onReject={handleReject}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Reviewed Applications */}
          {reviewedApplications.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                Reviewed Applications
                <span className="ml-2 bg-gray-100 text-gray-800 text-sm font-medium px-2.5 py-0.5 rounded-full">
                  {reviewedApplications.length}
                </span>
              </h3>
              <div className="space-y-4">
                {reviewedApplications.map((application) => (
                  <GameApplicationCard
                    key={application.id}
                    application={application}
                    isGM={true}
                    gameState={gameState}
                    onApprove={handleApprove}
                    onReject={handleReject}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
