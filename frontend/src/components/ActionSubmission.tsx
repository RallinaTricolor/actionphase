import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { CountdownTimer } from './CountdownTimer';
import type { GamePhase, ActionSubmissionRequest, ActionWithDetails } from '../types/phases';

interface ActionSubmissionProps {
  gameId: number;
  currentPhase?: GamePhase | null;
  className?: string;
}

export function ActionSubmission({ gameId, currentPhase, className = '' }: ActionSubmissionProps) {
  // Get current user from AuthContext
  const { currentUser } = useAuth();
  const currentUserId = currentUser?.id ?? null;

  const [content, setContent] = useState('');
  const [selectedCharacterId, setSelectedCharacterId] = useState<number | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showPreviousActions, setShowPreviousActions] = useState(false);

  const queryClient = useQueryClient();

  // Get user's characters for this game
  const { data: characters = [] } = useQuery({
    queryKey: ['gameCharacters', gameId],
    queryFn: () => apiClient.getGameCharacters(gameId).then(res => res.data),
    enabled: !!gameId
  });

  // Get user's previous actions
  const { data: userActionsData } = useQuery({
    queryKey: ['userActions', gameId],
    queryFn: () => apiClient.getUserActions(gameId).then(res => res.data),
    enabled: !!gameId
  });

  // Ensure userActions is always an array
  const userActions = userActionsData || [];

  // Get current action for this phase if it exists
  const currentAction = currentPhase
    ? userActions.find(action => action.phase_id === currentPhase.id)
    : null;

  // Filter characters to only show those owned by or assigned to the current user (memoized)
  const availableCharacters = useMemo(() => {
    return characters.filter(char => {
      // Include if character belongs to the current user
      return char.user_id === currentUserId;
    });
  }, [characters, currentUserId]);

  const submitActionMutation = useMutation({
    mutationFn: (data: ActionSubmissionRequest) => apiClient.submitAction(gameId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userActions', gameId] });
      setContent('');
      setIsExpanded(false);
    }
  });

  // Pre-populate form if editing existing action
  useEffect(() => {
    if (currentAction) {
      setContent(currentAction.content);
      if (currentAction.character_id) {
        setSelectedCharacterId(currentAction.character_id);
      }
    } else {
      setContent('');
      // Auto-select character if player has exactly one
      if (availableCharacters.length === 1) {
        setSelectedCharacterId(availableCharacters[0].id);
      } else {
        setSelectedCharacterId(null);
      }
    }
  }, [currentAction, availableCharacters]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || !currentPhase) return;

    const data: ActionSubmissionRequest = {
      content: content.trim(),
      character_id: selectedCharacterId || undefined
    };

    submitActionMutation.mutate(data);
  };

  const isActionPhase = currentPhase?.phase_type === 'action';
  const isPhaseActive = currentPhase?.is_active;
  const isDeadlinePassed = currentPhase?.deadline && new Date() > new Date(currentPhase.deadline);

  const canSubmitAction = isActionPhase && isPhaseActive && !isDeadlinePassed;

  if (!isActionPhase) {
    return (
      <div className={`bg-gray-50 border border-gray-200 rounded-lg p-6 text-center ${className}`}>
        <div className="text-gray-500 mb-2">
          <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-1">No Action Phase Active</h3>
        <p className="text-sm text-gray-500">
          Action submissions are only available during Action phases.
        </p>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg border border-gray-200 ${className}`}>
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Action Submission</h2>
            <p className="text-sm text-gray-600 mt-1">
              {currentAction ? 'Update your action for this phase' : 'Submit your private action to the GM'}
            </p>
          </div>
          {currentPhase?.deadline && (
            <CountdownTimer
              deadline={currentPhase.deadline}
              className="flex-shrink-0"
            />
          )}
        </div>

        {!canSubmitAction && (
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-yellow-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.728-.833-2.598 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <span className="text-yellow-800 text-sm">
                {isDeadlinePassed
                  ? 'The action submission deadline has passed'
                  : 'Action submission is not currently available'
                }
              </span>
            </div>
          </div>
        )}

        {/* Current Action Display */}
        {currentAction && !isExpanded && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="font-medium text-blue-900 mb-2">Your Current Action</h3>
                <div className="text-sm text-blue-800 bg-white p-3 rounded border whitespace-pre-wrap">
                  {currentAction.content}
                </div>
                {currentAction.character_name && (
                  <p className="text-sm text-blue-700 mt-2">
                    Acting as: <span className="font-medium">{currentAction.character_name}</span>
                  </p>
                )}
                <p className="text-xs text-blue-600 mt-1">
                  Last updated: {new Date(currentAction.updated_at).toLocaleString()}
                </p>
              </div>
              {canSubmitAction && (
                <button
                  onClick={() => setIsExpanded(true)}
                  className="ml-4 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-md transition-colors"
                >
                  Edit
                </button>
              )}
            </div>
          </div>
        )}

        {/* Submission Form */}
        {(!currentAction || isExpanded) && canSubmitAction && (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Character Selection - only show dropdown if multiple characters */}
            {availableCharacters.length > 1 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Acting as Character (Optional)
                </label>
                <select
                  value={selectedCharacterId || ''}
                  onChange={(e) => setSelectedCharacterId(e.target.value ? parseInt(e.target.value) : null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select a character (or leave blank)</option>
                  {availableCharacters.map((character) => (
                    <option key={character.id} value={character.id}>
                      {character.name} ({character.character_type.replace('_', ' ')})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Display single character */}
            {availableCharacters.length === 1 && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                <p className="text-sm text-blue-900">
                  <span className="font-medium">Acting as:</span> {availableCharacters[0].name}
                </p>
              </div>
            )}

            {/* Action Content */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Your Action <span className="text-red-500">*</span>
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Describe what your character does during this phase. Be as detailed as you like - this will only be seen by the GM until the game ends."
                rows={8}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
                disabled={submitActionMutation.isPending}
              />
              <p className="text-sm text-gray-500 mt-1">
                This action is private and will only be visible to the GM during the game.
              </p>
            </div>

            {/* Submit Buttons */}
            <div className="flex justify-end space-x-3">
              {currentAction && isExpanded && (
                <button
                  type="button"
                  onClick={() => {
                    setIsExpanded(false);
                    setContent(currentAction.content);
                    setSelectedCharacterId(currentAction.character_id || null);
                  }}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                disabled={!content.trim() || submitActionMutation.isPending}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitActionMutation.isPending
                  ? 'Submitting...'
                  : currentAction
                  ? 'Update Action'
                  : 'Submit Action'
                }
              </button>
            </div>
          </form>
        )}

        {/* Error Display */}
        {submitActionMutation.error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-700">
              Failed to submit action: {
                submitActionMutation.error instanceof Error
                  ? submitActionMutation.error.message
                  : 'Unknown error'
              }
            </p>
          </div>
        )}
      </div>

      {/* Action History */}
      {(() => {
        const previousActions = userActions.filter(action => action.phase_id !== currentPhase?.id);
        return previousActions.length > 0 && (
          <div className="border-t border-gray-200">
            <button
              onClick={() => setShowPreviousActions(!showPreviousActions)}
              className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center">
                <svg className="w-5 h-5 text-gray-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h3 className="text-lg font-medium text-gray-900">
                  Your Previous Actions ({previousActions.length})
                </h3>
              </div>
              <svg
                className={`w-5 h-5 text-gray-400 transition-transform ${showPreviousActions ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showPreviousActions && (
              <div className="px-6 pb-6">
                <ActionHistory actions={userActions} currentPhaseId={currentPhase?.id} />
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}

interface ActionHistoryProps {
  actions: ActionWithDetails[];
  currentPhaseId?: number;
}

function ActionHistory({ actions, currentPhaseId }: ActionHistoryProps) {
  // Filter out the current phase action
  const previousActions = actions.filter(action => action.phase_id !== currentPhaseId);
  const sortedActions = [...previousActions].sort((a, b) => (b.phase_number || 0) - (a.phase_number || 0));

  if (sortedActions.length === 0) {
    return (
      <div className="text-center py-4 text-gray-500">
        <p>No previous actions</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {sortedActions.map((action) => (
        <div key={action.id} className="border border-gray-200 rounded-lg p-4">
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center space-x-2">
              <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded font-medium">
                Phase {action.phase_number} - {action.phase_type?.replace('_', ' ')}
              </span>
              {action.character_name && (
                <span className="text-sm text-gray-600">
                  as {action.character_name}
                </span>
              )}
            </div>
            <span className="text-xs text-gray-500">
              {new Date(action.submitted_at).toLocaleString()}
            </span>
          </div>
          <div className="text-sm text-gray-900 bg-gray-50 p-3 rounded whitespace-pre-wrap">
            {action.content}
          </div>
        </div>
      ))}
    </div>
  );
}
