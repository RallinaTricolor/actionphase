import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api';
import { CountdownTimer, SimpleCountdown } from './CountdownTimer';
import {
  PHASE_TYPE_LABELS,
  PHASE_TYPE_DESCRIPTIONS,
  PHASE_TYPE_COLORS,
  getActionPhaseLabel,
  getActionPhaseColor
} from '../types/phases';
import type { GamePhase, CreatePhaseRequest, UpdatePhaseRequest, UpdateDeadlineRequest } from '../types/phases';

interface PhaseManagementProps {
  gameId: number;
  className?: string;
}

export function PhaseManagement({ gameId, className = '' }: PhaseManagementProps) {
  const [isCreatingPhase, setIsCreatingPhase] = useState(false);
  const [selectedPhaseId, setSelectedPhaseId] = useState<number | null>(null);
  const [isEditingDeadline, setIsEditingDeadline] = useState<number | null>(null);
  const [editingPhase, setEditingPhase] = useState<GamePhase | null>(null);

  const queryClient = useQueryClient();

  const { data: phasesData, isLoading } = useQuery({
    queryKey: ['gamePhases', gameId],
    queryFn: () => apiClient.getGamePhases(gameId).then(res => res.data),
    enabled: !!gameId,
    refetchOnMount: 'always',
    staleTime: 0
  });

  // Ensure phases is always an array
  const phases = phasesData || [];

  const { data: currentPhaseData } = useQuery({
    queryKey: ['currentPhase', gameId],
    queryFn: () => apiClient.getCurrentPhase(gameId).then(res => res.data),
    enabled: !!gameId,
    refetchOnMount: 'always',
    staleTime: 0
  });

  const createPhaseMutation = useMutation({
    mutationFn: (data: CreatePhaseRequest) => apiClient.createPhase(gameId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gamePhases', gameId] });
      queryClient.invalidateQueries({ queryKey: ['currentPhase', gameId] });
      setIsCreatingPhase(false);
    }
  });

  const activatePhaseMutation = useMutation({
    mutationFn: (phaseId: number) => apiClient.activatePhase(phaseId),
    onSuccess: async () => {
      // Force immediate refetch instead of just invalidation
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ['gamePhases', gameId] }),
        queryClient.refetchQueries({ queryKey: ['currentPhase', gameId] })
      ]);
    },
    onError: (error) => {
      console.error('Failed to activate phase:', error);
      alert(error instanceof Error ? error.message : 'Failed to activate phase');
    }
  });

  const updateDeadlineMutation = useMutation({
    mutationFn: ({ phaseId, data }: { phaseId: number; data: UpdateDeadlineRequest }) =>
      apiClient.updatePhaseDeadline(phaseId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gamePhases', gameId] });
      queryClient.invalidateQueries({ queryKey: ['currentPhase', gameId] });
      setIsEditingDeadline(null);
    }
  });

  const updatePhaseMutation = useMutation({
    mutationFn: ({ phaseId, data }: { phaseId: number; data: UpdatePhaseRequest }) =>
      apiClient.updatePhase(phaseId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gamePhases', gameId] });
      queryClient.invalidateQueries({ queryKey: ['currentPhase', gameId] });
      setEditingPhase(null);
    }
  });

  const currentPhase = currentPhaseData?.phase || phases.find(p => p.is_active);

  if (isLoading) {
    return (
      <div className={`bg-white rounded-lg border border-gray-200 p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded mb-4 w-1/3"></div>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg border border-gray-200 ${className}`}>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Phase Management</h2>
            <p className="text-sm text-gray-600 mt-1">
              Create and control game phases to structure your session
            </p>
          </div>
          <button
            onClick={() => setIsCreatingPhase(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
          >
            New Phase
          </button>
        </div>

        {/* Current Phase Summary */}
        {currentPhase && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-blue-900">Currently Active</h3>
                <p className="text-sm text-blue-700">
                  {PHASE_TYPE_LABELS[currentPhase.phase_type]} (Phase {currentPhase.phase_number})
                </p>
              </div>
              {currentPhase.deadline && (
                <CountdownTimer deadline={currentPhase.deadline} />
              )}
            </div>
          </div>
        )}

        {/* Phase List */}
        <div className="space-y-3">
          {phases.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p>No phases created yet</p>
              <p className="text-sm">Create your first phase to begin the game session</p>
            </div>
          ) : (
            phases.map((phase) => (
              <PhaseCard
                key={phase.id}
                phase={phase}
                gameId={gameId}
                currentPhaseId={currentPhase?.id}
                isActive={phase.is_active}
                isSelected={selectedPhaseId === phase.id}
                isEditingDeadline={isEditingDeadline === phase.id}
                onSelect={() => setSelectedPhaseId(phase.id)}
                onActivate={() => activatePhaseMutation.mutate(phase.id)}
                onEdit={() => setEditingPhase(phase)}
                onEditDeadline={() => setIsEditingDeadline(phase.id)}
                onUpdateDeadline={(deadline) =>
                  updateDeadlineMutation.mutate({
                    phaseId: phase.id,
                    data: { deadline }
                  })
                }
                onCancelEditDeadline={() => setIsEditingDeadline(null)}
                isActivating={activatePhaseMutation.isPending}
                isUpdatingDeadline={updateDeadlineMutation.isPending}
              />
            ))
          )}
        </div>
      </div>

      {/* Create Phase Modal */}
      {isCreatingPhase && (
        <CreatePhaseModal
          onClose={() => setIsCreatingPhase(false)}
          onSubmit={(data) => createPhaseMutation.mutate(data)}
          isSubmitting={createPhaseMutation.isPending}
        />
      )}

      {/* Edit Phase Modal */}
      {editingPhase && (
        <EditPhaseModal
          phase={editingPhase}
          onClose={() => setEditingPhase(null)}
          onSubmit={(data) => updatePhaseMutation.mutate({
            phaseId: editingPhase.id,
            data
          })}
          isSubmitting={updatePhaseMutation.isPending}
        />
      )}
    </div>
  );
}

interface PhaseCardProps {
  phase: GamePhase;
  gameId: number;
  currentPhaseId?: number;
  isActive: boolean;
  isSelected: boolean;
  isEditingDeadline: boolean;
  onSelect: () => void;
  onActivate: () => void;
  onEdit: () => void;
  onEditDeadline: () => void;
  onUpdateDeadline: (deadline: string) => void;
  onCancelEditDeadline: () => void;
  isActivating: boolean;
  isUpdatingDeadline: boolean;
}

function PhaseCard({
  phase,
  gameId,
  currentPhaseId,
  isActive,
  isSelected,
  isEditingDeadline,
  onSelect,
  onActivate,
  onEdit,
  onEditDeadline,
  onUpdateDeadline,
  onCancelEditDeadline,
  isActivating,
  isUpdatingDeadline,
}: PhaseCardProps) {
  const [deadlineInput, setDeadlineInput] = useState('');
  const [showActivateConfirm, setShowActivateConfirm] = useState(false);
  const queryClient = useQueryClient();

  // Query for unpublished results in the current phase
  const { data: unpublishedCountData } = useQuery({
    queryKey: ['unpublishedResultsCount', gameId, currentPhaseId],
    queryFn: () => apiClient.getUnpublishedResultsCount(gameId, currentPhaseId!).then(res => res.data),
    enabled: !!gameId && !!currentPhaseId && showActivateConfirm,
  });

  const unpublishedCount = unpublishedCountData?.count || 0;

  // Mutation for publishing all results
  const publishAllMutation = useMutation({
    mutationFn: () => apiClient.publishAllPhaseResults(gameId, currentPhaseId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unpublishedResultsCount'] });
      queryClient.invalidateQueries({ queryKey: ['userResults'] });
    }
  });

  const phaseColorClass = getActionPhaseColor(phase);
  const phaseLabel = getActionPhaseLabel(phase);

  const borderClass = isActive
    ? 'border-blue-500 bg-blue-50'
    : isSelected
    ? 'border-gray-300 bg-gray-50'
    : 'border-gray-200 hover:border-gray-300';

  const handleDeadlineSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (deadlineInput) {
      onUpdateDeadline(deadlineInput);
    }
  };

  return (
    <div
      className={`border rounded-lg p-4 transition-colors cursor-pointer ${borderClass}`}
      onClick={onSelect}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <span className={`px-2 py-1 text-xs rounded-full font-medium border ${phaseColorClass}`}>
            Phase {phase.phase_number}
          </span>
          <div>
            <h4 className="font-medium text-gray-900">{phaseLabel}</h4>
            <p className="text-sm text-gray-600">
              {PHASE_TYPE_DESCRIPTIONS[phase.phase_type]}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {phase.deadline && !isEditingDeadline && (
            <SimpleCountdown
              deadline={phase.deadline}
              className="text-gray-600"
            />
          )}

          {!isActive && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowActivateConfirm(true);
              }}
              disabled={isActivating}
              className="px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors disabled:opacity-50"
            >
              {isActivating ? 'Activating...' : 'Activate'}
            </button>
          )}

          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
            title="Edit phase details"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Edit Deadline Form */}
      {isEditingDeadline && (
        <form onSubmit={handleDeadlineSubmit} className="mt-4 pt-4 border-t border-gray-200" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-end space-x-2">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Set Deadline
              </label>
              <input
                type="datetime-local"
                value={deadlineInput}
                onChange={(e) => setDeadlineInput(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>
            <button
              type="submit"
              disabled={isUpdatingDeadline}
              className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-md transition-colors disabled:opacity-50"
            >
              {isUpdatingDeadline ? 'Saving...' : 'Save'}
            </button>
            <button
              type="button"
              onClick={onCancelEditDeadline}
              className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Active Phase Indicator */}
      {isActive && (
        <div className="mt-3 flex items-center text-sm text-blue-700">
          <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
          Currently Active
        </div>
      )}

      {/* Phase Activation Confirmation Dialog */}
      {showActivateConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" onClick={(e) => e.stopPropagation()}>
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Activate Phase {phase.phase_number}?</h3>

            {currentPhaseId && unpublishedCount > 0 ? (
              <>
                <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded">
                  <div className="flex items-start">
                    <svg className="w-5 h-5 text-amber-500 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-amber-900">
                        You have {unpublishedCount} unpublished {unpublishedCount === 1 ? 'result' : 'results'}
                      </p>
                      <p className="text-sm text-amber-700 mt-1">
                        Do you want to publish {unpublishedCount === 1 ? 'it' : 'them'} before activating the next phase?
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col space-y-2">
                  <button
                    onClick={async () => {
                      await publishAllMutation.mutateAsync();
                      onActivate();
                      setShowActivateConfirm(false);
                    }}
                    disabled={isActivating || publishAllMutation.isPending}
                    className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {publishAllMutation.isPending ? 'Publishing...' : isActivating ? 'Activating...' : 'Publish & Activate Phase'}
                  </button>
                  <button
                    onClick={() => {
                      onActivate();
                      setShowActivateConfirm(false);
                    }}
                    disabled={isActivating || publishAllMutation.isPending}
                    className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isActivating ? 'Activating...' : 'Activate Without Publishing'}
                  </button>
                  <button
                    onClick={() => setShowActivateConfirm(false)}
                    disabled={isActivating || publishAllMutation.isPending}
                    className="w-full px-4 py-2 text-sm text-gray-600 hover:text-gray-800 disabled:opacity-50 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-gray-600 mb-6">
                  This will deactivate the current phase and make Phase {phase.phase_number} active. Continue?
                </p>
                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => setShowActivateConfirm(false)}
                    disabled={isActivating}
                    className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      onActivate();
                      setShowActivateConfirm(false);
                    }}
                    disabled={isActivating}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isActivating ? 'Activating...' : 'Activate Phase'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface CreatePhaseModalProps {
  onClose: () => void;
  onSubmit: (data: CreatePhaseRequest) => void;
  isSubmitting: boolean;
}

function CreatePhaseModal({ onClose, onSubmit, isSubmitting }: CreatePhaseModalProps) {
  const [formData, setFormData] = useState<CreatePhaseRequest>({
    phase_type: 'common_room',
    deadline: undefined
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <form onSubmit={handleSubmit} className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Create New Phase</h3>
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Phase Type
              </label>
              <select
                value={formData.phase_type}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  phase_type: e.target.value as CreatePhaseRequest['phase_type']
                }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              >
                <option value="common_room">Common Room</option>
                <option value="action">Action Phase</option>
              </select>
              <p className="text-sm text-gray-600 mt-1">
                {PHASE_TYPE_DESCRIPTIONS[formData.phase_type]}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Title (Optional)
              </label>
              <input
                type="text"
                value={formData.title || ''}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  title: e.target.value || undefined
                }))}
                placeholder="e.g., 'The Gathering Storm'"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="text-sm text-gray-500 mt-1">
                Give this phase a custom name
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description (Optional)
              </label>
              <textarea
                value={formData.description || ''}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  description: e.target.value || undefined
                }))}
                placeholder="Describe what happens in this phase..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Deadline (Optional)
              </label>
              <input
                type="datetime-local"
                value={formData.deadline || ''}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  deadline: e.target.value || undefined
                }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="text-sm text-gray-500 mt-1">
                Set a deadline to create urgency for this phase
              </p>
            </div>
          </div>

          <div className="flex justify-end space-x-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-md transition-colors disabled:opacity-50"
            >
              {isSubmitting ? 'Creating...' : 'Create Phase'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface EditPhaseModalProps {
  phase: GamePhase;
  onClose: () => void;
  onSubmit: (data: UpdatePhaseRequest) => void;
  isSubmitting: boolean;
}

function EditPhaseModal({ phase, onClose, onSubmit, isSubmitting }: EditPhaseModalProps) {
  const [formData, setFormData] = useState<UpdatePhaseRequest>({
    title: phase.title || '',
    description: phase.description || '',
    deadline: phase.deadline ? new Date(phase.deadline).toISOString().slice(0, 16) : ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      title: formData.title || undefined,
      description: formData.description || undefined,
      deadline: formData.deadline || undefined
    });
  };

  const phaseLabel = PHASE_TYPE_LABELS[phase.phase_type];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <form onSubmit={handleSubmit} className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Edit Phase</h3>
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="space-y-4">
            {/* Phase Type (Read-only) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Phase Type
              </label>
              <div className="px-3 py-2 border border-gray-200 rounded-md bg-gray-50 text-gray-700">
                {phaseLabel} (Phase {phase.phase_number})
              </div>
              <p className="text-sm text-gray-500 mt-1">
                {PHASE_TYPE_DESCRIPTIONS[phase.phase_type]}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Title (Optional)
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  title: e.target.value
                }))}
                placeholder="e.g., 'The Gathering Storm'"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="text-sm text-gray-500 mt-1">
                Give this phase a custom name
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description (Optional)
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  description: e.target.value
                }))}
                placeholder="Describe what happens in this phase..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Deadline (Optional)
              </label>
              <input
                type="datetime-local"
                value={formData.deadline}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  deadline: e.target.value
                }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="text-sm text-gray-500 mt-1">
                Set or update the deadline for this phase
              </p>
            </div>
          </div>

          <div className="flex justify-end space-x-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-md transition-colors disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
