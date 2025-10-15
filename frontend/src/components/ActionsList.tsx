import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api';
import type { ActionWithDetails, GamePhase } from '../types/phases';
import { CreateActionResultForm } from './CreateActionResultForm';

interface ActionsListProps {
  gameId: number;
  currentPhase?: GamePhase | null;
  className?: string;
}

export function ActionsList({ gameId, currentPhase, className = '' }: ActionsListProps) {
  const [selectedPhase, setSelectedPhase] = useState<number | null>(null);
  const [expandedActionId, setExpandedActionId] = useState<number | null>(null);
  const [showPublishConfirm, setShowPublishConfirm] = useState(false);
  const queryClient = useQueryClient();

  // Get all actions for the game
  const { data: actionsData, isLoading } = useQuery({
    queryKey: ['gameActions', gameId],
    queryFn: () => apiClient.getGameActions(gameId).then(res => res.data),
    enabled: !!gameId,
    refetchInterval: 30000 // Refetch every 30 seconds
  });

  // Get all phases for filtering
  const { data: phasesData } = useQuery({
    queryKey: ['gamePhases', gameId],
    queryFn: () => apiClient.getGamePhases(gameId).then(res => res.data),
    enabled: !!gameId
  });

  // Get unpublished results count for current phase
  const displayPhaseId = selectedPhase || currentPhase?.id;
  const { data: unpublishedCountData } = useQuery({
    queryKey: ['unpublishedResultsCount', gameId, displayPhaseId],
    queryFn: () => apiClient.getUnpublishedResultsCount(gameId, displayPhaseId!).then(res => res.data),
    enabled: !!gameId && !!displayPhaseId,
    refetchInterval: 10000 // Refetch every 10 seconds
  });

  // Mutation for publishing all results
  const publishAllMutation = useMutation({
    mutationFn: () => apiClient.publishAllPhaseResults(gameId, displayPhaseId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unpublishedResultsCount', gameId, displayPhaseId] });
      queryClient.invalidateQueries({ queryKey: ['userResults', gameId] });
      setShowPublishConfirm(false);
    }
  });

  const actions = actionsData || [];
  const phases = phasesData || [];

  // Only show action phases
  const actionPhases = phases.filter(phase => phase.phase_type === 'action');

  // Filter actions by selected phase (only action phases)
  const filteredActions = displayPhaseId
    ? actions.filter(action => action.phase_id === displayPhaseId)
    : actions;

  // Group actions by phase for stats (only action phases)
  const actionsByPhase = actions.reduce((acc, action) => {
    const phaseId = action.phase_id;
    if (!acc[phaseId]) {
      acc[phaseId] = [];
    }
    acc[phaseId].push(action);
    return acc;
  }, {} as Record<number, ActionWithDetails[]>);

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

  // Don't show the component if there are no action phases
  if (actionPhases.length === 0) {
    return null;
  }

  const unpublishedCount = unpublishedCountData?.count || 0;

  return (
    <div className={`bg-white rounded-lg border border-gray-200 ${className}`}>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Submitted Actions</h2>
            <p className="text-sm text-gray-600 mt-1">
              View and manage player action submissions
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <span className="px-3 py-1 bg-blue-100 text-blue-800 text-sm font-medium rounded-full">
              {filteredActions.length} {filteredActions.length === 1 ? 'Action' : 'Actions'}
            </span>
          </div>
        </div>

        {/* Publish All Results Button */}
        {displayPhaseId && unpublishedCount > 0 && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <svg className="w-5 h-5 text-amber-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div>
                  <p className="font-medium text-amber-900">
                    {unpublishedCount} unpublished {unpublishedCount === 1 ? 'result' : 'results'}
                  </p>
                  <p className="text-sm text-amber-700 mt-0.5">
                    These results are ready to be sent to players
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowPublishConfirm(true)}
                disabled={publishAllMutation.isPending}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {publishAllMutation.isPending ? 'Publishing...' : 'Publish All Results'}
              </button>
            </div>
          </div>
        )}

        {/* Confirmation Dialog */}
        {showPublishConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-md w-full p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Publish All Results?</h3>
              <p className="text-sm text-gray-600 mb-6">
                This will publish {unpublishedCount} {unpublishedCount === 1 ? 'result' : 'results'} and make {unpublishedCount === 1 ? 'it' : 'them'} visible to players. This action cannot be undone.
              </p>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowPublishConfirm(false)}
                  disabled={publishAllMutation.isPending}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => publishAllMutation.mutate()}
                  disabled={publishAllMutation.isPending}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {publishAllMutation.isPending ? 'Publishing...' : 'Confirm & Publish'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Phase Filter - Only show action phases */}
        {actionPhases.length > 0 && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Filter by Action Phase
            </label>
            <select
              value={selectedPhase || (currentPhase?.phase_type === 'action' ? currentPhase?.id : '') || ''}
              onChange={(e) => setSelectedPhase(e.target.value ? parseInt(e.target.value) : null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Action Phases</option>
              {actionPhases.map((phase) => (
                <option key={phase.id} value={phase.id}>
                  Phase {phase.phase_number} - Action Phase
                  {actionsByPhase[phase.id] ? ` (${actionsByPhase[phase.id].length})` : ' (0)'}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Actions List */}
        {filteredActions.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p>No actions submitted yet</p>
            <p className="text-sm mt-1">
              {displayPhaseId ? 'No actions for this phase' : 'Actions will appear here once players submit them'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredActions.map((action) => (
              <ActionCard
                key={action.id}
                action={action}
                gameId={gameId}
                isExpanded={expandedActionId === action.id}
                onToggleExpand={() => setExpandedActionId(expandedActionId === action.id ? null : action.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface ActionCardProps {
  action: ActionWithDetails;
  gameId: number;
  isExpanded: boolean;
  onToggleExpand: () => void;
}

function ActionCard({ action, gameId, isExpanded, onToggleExpand }: ActionCardProps) {
  const [showResultForm, setShowResultForm] = useState(false);
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden hover:border-gray-300 transition-colors">
      <button
        onClick={onToggleExpand}
        className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center space-x-3 flex-1">
          <div className="flex-shrink-0">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2">
              <h4 className="font-medium text-gray-900">{action.username}</h4>
              {action.character_name && (
                <span className="px-2 py-0.5 bg-purple-100 text-purple-800 text-xs rounded-full">
                  as {action.character_name}
                </span>
              )}
            </div>
            <div className="flex items-center space-x-2 mt-1">
              {action.phase_type && action.phase_number && (
                <span className="text-xs text-gray-500">
                  Phase {action.phase_number} - {action.phase_type.replace('_', ' ')}
                </span>
              )}
              <span className="text-xs text-gray-400">•</span>
              <span className="text-xs text-gray-500">
                {new Date(action.submitted_at).toLocaleString()}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <svg
            className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {isExpanded && (
        <div className="px-4 py-4 bg-gray-50 border-t border-gray-200">
          <div className="prose prose-sm max-w-none">
            <div className="bg-white p-4 rounded border border-gray-200 whitespace-pre-wrap text-gray-900">
              {action.content}
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
            <span>
              Last updated: {new Date(action.updated_at).toLocaleString()}
            </span>
          </div>

          {/* GM Action: Send Result */}
          <div className="mt-4 pt-4 border-t border-gray-200">
            {!showResultForm ? (
              <button
                onClick={() => setShowResultForm(true)}
                className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md font-medium transition-colors"
              >
                Send Result to {action.username}
              </button>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h5 className="font-semibold text-gray-900">Send Result</h5>
                  <button
                    onClick={() => setShowResultForm(false)}
                    className="text-sm text-gray-600 hover:text-gray-800"
                  >
                    Cancel
                  </button>
                </div>
                <CreateActionResultForm
                  gameId={gameId}
                  userId={action.user_id}
                  userName={action.username}
                  onSuccess={() => {
                    setShowResultForm(false);
                    // Could add a success toast here
                  }}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
