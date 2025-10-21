import React from 'react';
import { useUserActionResults } from '../hooks/useActionResults';
import { Alert } from './ui';

interface ActionResultsListProps {
  gameId: number;
}

export const ActionResultsList: React.FC<ActionResultsListProps> = ({ gameId }) => {
  const { data: results, isLoading, error } = useUserActionResults(gameId);

  if (isLoading) {
    return (
      <div className="p-4">
        <p className="text-content-secondary">Loading your action results...</p>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="danger">
        Error loading action results
      </Alert>
    );
  }

  if (!results || results.length === 0) {
    return (
      <div className="p-4 surface-raised border border-theme-default rounded">
        <p className="text-content-secondary">No action results yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-content-primary">Your Action Results</h3>
      {results.map((result) => (
        <div key={result.id} className="p-4 surface-base border border-theme-default rounded shadow-sm">
          <div className="flex justify-between items-start mb-2">
            <span className="text-sm text-content-tertiary">
              Phase {result.phase_number} - {result.phase_type}
            </span>
            {result.sent_at && (
              <span className="text-xs text-content-tertiary">
                {new Date(result.sent_at).toLocaleString()}
              </span>
            )}
          </div>
          <div className="prose dark:prose-invert max-w-none">
            <p className="text-content-primary">{result.content}</p>
          </div>
          {result.gm_username && (
            <p className="text-xs text-content-tertiary mt-2">From: {result.gm_username}</p>
          )}
        </div>
      ))}
    </div>
  );
};
