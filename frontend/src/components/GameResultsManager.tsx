import { useState } from 'react';
import { useGameActionResults, useUpdateActionResult } from '../hooks/useActionResults';
import type { ActionResult } from '../types/phases';

interface GameResultsManagerProps {
  gameId: number;
  className?: string;
}

export function GameResultsManager({ gameId, className = '' }: GameResultsManagerProps) {
  const { data: results, isLoading } = useGameActionResults(gameId);
  const [editingResultId, setEditingResultId] = useState<number | null>(null);

  if (isLoading) {
    return (
      <div className={`bg-white rounded-lg border border-gray-200 p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded mb-4 w-1/3"></div>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const allResults = results || [];
  const unpublishedResults = allResults.filter(r => !r.is_published);
  const publishedResults = allResults.filter(r => r.is_published);

  if (allResults.length === 0) {
    return (
      <div className={`bg-white rounded-lg border border-gray-200 p-6 ${className}`}>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Action Results</h2>
        <p className="text-sm text-gray-600">No results have been created yet.</p>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg border border-gray-200 ${className}`}>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Action Results</h2>
            <p className="text-sm text-gray-600 mt-1">
              Manage results sent to players
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <span className="px-3 py-1 bg-amber-100 text-amber-800 text-sm font-medium rounded-full">
              {unpublishedResults.length} Unpublished
            </span>
            <span className="px-3 py-1 bg-green-100 text-green-800 text-sm font-medium rounded-full">
              {publishedResults.length} Published
            </span>
          </div>
        </div>

        {/* Unpublished Results Section */}
        {unpublishedResults.length > 0 && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
              <svg className="w-5 h-5 text-amber-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              Unpublished Results (Editable)
            </h3>
            <div className="space-y-3">
              {unpublishedResults.map((result) => (
                <ResultCard
                  key={result.id}
                  result={result}
                  gameId={gameId}
                  isEditing={editingResultId === result.id}
                  onStartEdit={() => setEditingResultId(result.id)}
                  onCancelEdit={() => setEditingResultId(null)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Published Results Section */}
        {publishedResults.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
              <svg className="w-5 h-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Published Results
            </h3>
            <div className="space-y-3">
              {publishedResults.map((result) => (
                <ResultCard
                  key={result.id}
                  result={result}
                  gameId={gameId}
                  isEditing={false}
                  onStartEdit={() => {}}
                  onCancelEdit={() => {}}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface ResultCardProps {
  result: ActionResult;
  gameId: number;
  isEditing: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
}

function ResultCard({ result, gameId, isEditing, onStartEdit, onCancelEdit }: ResultCardProps) {
  const [editedContent, setEditedContent] = useState(result.content);
  const updateMutation = useUpdateActionResult(gameId);

  const handleSave = async () => {
    if (editedContent.trim() === result.content) {
      onCancelEdit();
      return;
    }

    try {
      await updateMutation.mutateAsync({
        resultId: result.id,
        content: editedContent.trim(),
      });
      onCancelEdit();
    } catch (error) {
      console.error('Failed to update result:', error);
    }
  };

  const handleCancel = () => {
    setEditedContent(result.content);
    onCancelEdit();
  };

  return (
    <div className={`border rounded-lg overflow-hidden ${result.is_published ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50'}`}>
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${result.is_published ? 'bg-green-100' : 'bg-amber-100'}`}>
                <svg className={`w-5 h-5 ${result.is_published ? 'text-green-600' : 'text-amber-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
            </div>
            <div>
              <h4 className="font-medium text-gray-900">
                To: {result.username || `User #${result.user_id}`}
              </h4>
              <div className="flex items-center space-x-2 text-xs text-gray-600 mt-0.5">
                {result.phase_type && result.phase_number && (
                  <>
                    <span>Phase {result.phase_number}</span>
                    <span>•</span>
                  </>
                )}
                {result.is_published && result.sent_at && (
                  <span>Sent: {new Date(result.sent_at).toLocaleString()}</span>
                )}
                {!result.is_published && (
                  <span className="font-medium text-amber-700">Draft</span>
                )}
              </div>
            </div>
          </div>
          {!result.is_published && !isEditing && (
            <button
              onClick={onStartEdit}
              className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
            >
              Edit
            </button>
          )}
        </div>

        {isEditing ? (
          <div className="space-y-3">
            <textarea
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
              rows={6}
              placeholder="Enter result content..."
            />
            <div className="flex justify-end space-x-2">
              <button
                onClick={handleCancel}
                disabled={updateMutation.isPending}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={updateMutation.isPending || !editedContent.trim()}
                className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
            {updateMutation.isError && (
              <p className="text-sm text-red-600">
                Failed to update result. Please try again.
              </p>
            )}
          </div>
        ) : (
          <div className="bg-white p-4 rounded border border-gray-200 whitespace-pre-wrap text-gray-900">
            {result.content}
          </div>
        )}
      </div>
    </div>
  );
}
