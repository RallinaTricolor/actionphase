import { useState } from 'react';
import { useGameActionResults, useUpdateActionResult } from '../hooks/useActionResults';
import type { ActionResult } from '../types/phases';
import { Button, Textarea, Badge } from './ui';

interface GameResultsManagerProps {
  gameId: number;
  className?: string;
}

export function GameResultsManager({ gameId, className = '' }: GameResultsManagerProps) {
  const { data: results, isLoading } = useGameActionResults(gameId);
  const [editingResultId, setEditingResultId] = useState<number | null>(null);

  if (isLoading) {
    return (
      <div className={`surface-base rounded-lg border border-theme-default p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-6 surface-sunken rounded mb-4 w-1/3"></div>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-24 surface-sunken rounded"></div>
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
      <div className={`surface-base rounded-lg border border-theme-default p-6 ${className}`}>
        <h2 className="text-xl font-semibold text-content-primary mb-2">Action Results</h2>
        <p className="text-sm text-content-secondary">No results have been created yet.</p>
      </div>
    );
  }

  return (
    <div className={`surface-base rounded-lg border border-theme-default ${className}`}>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold text-content-primary">Action Results</h2>
            <p className="text-sm text-content-secondary mt-1">
              Manage results sent to players
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <Badge variant="warning">
              {unpublishedResults.length} Unpublished
            </Badge>
            <Badge variant="success">
              {publishedResults.length} Published
            </Badge>
          </div>
        </div>

        {/* Unpublished Results Section */}
        {unpublishedResults.length > 0 && (
          <div className="mb-6" data-testid="unpublished-results-section">
            <h3 className="text-lg font-semibold text-content-primary mb-3 flex items-center">
              <svg className="w-5 h-5 text-semantic-warning mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
          <div data-testid="published-results-section">
            <h3 className="text-lg font-semibold text-content-primary mb-3 flex items-center">
              <svg className="w-5 h-5 text-semantic-success mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
  const [isExpanded, setIsExpanded] = useState(false);
  const updateMutation = useUpdateActionResult(gameId);

  // Determine if content should be collapsible (long unpublished results)
  const isCollapsible = !result.is_published && result.content.length > 200;
  const previewContent = result.content.substring(0, 200) + '...';

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
    <div className={`border rounded-lg overflow-hidden ${result.is_published ? 'border-semantic-success bg-semantic-success-subtle' : 'border-semantic-warning bg-semantic-warning-subtle'}`}>
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${result.is_published ? 'bg-semantic-success-subtle' : 'bg-semantic-warning-subtle'}`}>
                <svg className={`w-5 h-5 ${result.is_published ? 'text-semantic-success' : 'text-semantic-warning'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
            </div>
            <div>
              <h4 className="font-medium text-content-primary">
                To: {result.username || `User #${result.user_id}`}
              </h4>
              <div className="flex items-center space-x-2 text-xs text-content-secondary mt-0.5">
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
                  <span className="font-medium text-semantic-warning">Draft</span>
                )}
              </div>
            </div>
          </div>
          {!result.is_published && !isEditing && (
            <Button
              variant="primary"
              size="sm"
              onClick={onStartEdit}
            >
              Edit
            </Button>
          )}
        </div>

        {isEditing ? (
          <div className="space-y-3">
            <Textarea
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              rows={6}
              placeholder="Enter result content..."
            />
            <div className="flex justify-end space-x-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCancel}
                disabled={updateMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSave}
                disabled={updateMutation.isPending || !editedContent.trim()}
              >
                {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
            {updateMutation.isError && (
              <p className="text-sm text-semantic-danger">
                Failed to update result. Please try again.
              </p>
            )}
          </div>
        ) : (
          <>
            <div className="surface-base p-4 rounded border border-theme-default whitespace-pre-wrap text-content-primary">
              {isCollapsible && !isExpanded ? previewContent : result.content}
            </div>
            {isCollapsible && (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="mt-2 text-sm text-interactive-primary hover:text-interactive-primary-hover font-medium flex items-center"
              >
                {isExpanded ? (
                  <>
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                    Show less
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                    Show full content
                  </>
                )}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
