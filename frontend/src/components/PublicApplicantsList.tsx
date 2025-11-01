import { useState, useEffect } from 'react';
import { apiClient } from '../lib/api';
import type { PublicGameApplicant } from '../types/games';
import { Spinner, Alert, Badge } from './ui';

interface PublicApplicantsListProps {
  gameId: number;
}

/**
 * PublicApplicantsList - Shows who has applied to join a game
 *
 * PUBLIC ENDPOINT - No authentication required
 * Only shows:
 * - Username
 * - Role (player/audience)
 * - Applied date
 *
 * Does NOT show:
 * - Application status (pending/approved/rejected)
 * - Application message
 * - User email
 * - Reviewer information
 *
 * Only visible when game is in "recruitment" state.
 */
export function PublicApplicantsList({ gameId }: PublicApplicantsListProps) {
  const [applicants, setApplicants] = useState<PublicGameApplicant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchApplicants();
  }, [gameId]);

  const fetchApplicants = async () => {
    try {
      setLoading(true);
      const response = await apiClient.games.getPublicGameApplicants(gameId);
      setApplicants(response.data);
      setError(null);
    } catch (err: any) {
      // If forbidden, game is probably not in recruitment anymore
      if (err?.response?.status === 403) {
        setError('Applicant list is only visible during recruitment');
      } else {
        setError(err instanceof Error ? err.message : 'Failed to load applicants');
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-4">
        <Spinner size="md" label="Loading applicants..." />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="info">
        {error}
      </Alert>
    );
  }

  if (applicants.length === 0) {
    return (
      <div className="text-center py-4">
        <p className="text-content-tertiary">No applications yet</p>
      </div>
    );
  }

  // Group by role
  const players = applicants.filter(a => a.role === 'player');
  const audience = applicants.filter(a => a.role === 'audience');

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-content-primary">Applicants ({applicants.length})</h3>

      {players.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-content-secondary mb-2">Players ({players.length})</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            {players.map((applicant) => (
              <div
                key={applicant.id}
                className="border border-border-primary rounded-lg p-3 bg-bg-secondary"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-content-primary truncate">
                    {applicant.username}
                  </span>
                  <Badge variant="primary" size="sm">Player</Badge>
                </div>
                <div className="text-xs text-content-tertiary mt-1">
                  Applied {new Date(applicant.applied_at).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {audience.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-content-secondary mb-2">Audience ({audience.length})</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            {audience.map((applicant) => (
              <div
                key={applicant.id}
                className="border border-border-primary rounded-lg p-3 bg-bg-secondary"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-content-primary truncate">
                    {applicant.username}
                  </span>
                  <Badge variant="secondary" size="sm">Audience</Badge>
                </div>
                <div className="text-xs text-content-tertiary mt-1">
                  Applied {new Date(applicant.applied_at).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
