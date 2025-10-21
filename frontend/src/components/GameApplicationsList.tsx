import { useState, useEffect } from 'react';
import { apiClient } from '../lib/api';
import type { GameApplication, GameState } from '../types/games';
import { GameApplicationCard } from './GameApplicationCard';
import { Card, Spinner, Alert, Button, Badge } from './ui';

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
      const response = await apiClient.games.getGameApplications(gameId);
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
      await apiClient.games.reviewGameApplication(gameId, applicationId, { action: 'approve' });
      await fetchApplications(); // Refresh the list
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to approve application');
    }
  };

  const handleReject = async (applicationId: number) => {
    try {
      await apiClient.games.reviewGameApplication(gameId, applicationId, { action: 'reject' });
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
      <Card variant="elevated" padding="lg">
        <h2 className="text-2xl font-bold text-content-primary mb-6">Applications</h2>
        <div className="flex justify-center py-8">
          <Spinner size="lg" label="Loading applications..." />
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card variant="elevated" padding="lg">
        <h2 className="text-2xl font-bold text-content-primary mb-6">Applications</h2>
        <Alert variant="danger">
          <div className="space-y-3">
            <p>Failed to load applications: {error}</p>
            <Button variant="danger" size="sm" onClick={fetchApplications}>
              Retry
            </Button>
          </div>
        </Alert>
      </Card>
    );
  }

  const pendingApplications = applications.filter(app => app.status === 'pending');
  const reviewedApplications = applications.filter(app => app.status !== 'pending');

  return (
    <Card variant="elevated" padding="lg">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-content-primary">Applications</h2>
        <div className="text-sm text-content-tertiary">
          {applications.length} total applications
        </div>
      </div>

      {applications.length === 0 ? (
        <div className="text-center py-8">
          <div className="text-content-tertiary text-6xl mb-4">📋</div>
          <h3 className="text-lg font-medium text-content-primary mb-2">No Applications Yet</h3>
          <p className="text-content-tertiary">Players haven't submitted applications for this game yet.</p>
        </div>
      ) : (
        <>
          {/* Pending Applications */}
          {pendingApplications.length > 0 && (
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-content-primary mb-4 flex items-center">
                Pending Review
                <Badge variant="warning" size="sm" className="ml-2">
                  {pendingApplications.length}
                </Badge>
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
              <h3 className="text-lg font-semibold text-content-primary mb-4 flex items-center">
                Reviewed Applications
                <Badge variant="neutral" size="sm" className="ml-2">
                  {reviewedApplications.length}
                </Badge>
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
    </Card>
  );
};
