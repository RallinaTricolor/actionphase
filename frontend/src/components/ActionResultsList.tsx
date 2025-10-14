import React from 'react';
import { useUserActionResults } from '../hooks/useActionResults';

interface ActionResultsListProps {
  gameId: number;
}

export const ActionResultsList: React.FC<ActionResultsListProps> = ({ gameId }) => {
  const { data: results, isLoading, error } = useUserActionResults(gameId);

  if (isLoading) {
    return (
      <div className="p-4">
        <p>Loading your action results...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded">
        <p className="text-red-800">Error loading action results</p>
      </div>
    );
  }

  if (!results || results.length === 0) {
    return (
      <div className="p-4 bg-gray-50 border border-gray-200 rounded">
        <p className="text-gray-600">No action results yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Your Action Results</h3>
      {results.map((result) => (
        <div key={result.id} className="p-4 bg-white border border-gray-200 rounded shadow-sm">
          <div className="flex justify-between items-start mb-2">
            <span className="text-sm text-gray-500">
              Phase {result.phase_number} - {result.phase_type}
            </span>
            {result.sent_at && (
              <span className="text-xs text-gray-400">
                {new Date(result.sent_at).toLocaleString()}
              </span>
            )}
          </div>
          <div className="prose max-w-none">
            <p>{result.content}</p>
          </div>
          {result.gm_username && (
            <p className="text-xs text-gray-500 mt-2">From: {result.gm_username}</p>
          )}
        </div>
      ))}
    </div>
  );
};
