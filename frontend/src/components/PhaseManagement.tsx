import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api';
import { CountdownTimer, SimpleCountdown } from './CountdownTimer';
import {
  PHASE_TYPE_LABELS,
  PHASE_TYPE_DESCRIPTIONS,
  PHASE_TYPE_COLORS
} from '../types/phases';
import type { GamePhase, CreatePhaseRequest, UpdateDeadlineRequest } from '../types/phases';

interface PhaseManagementProps {
  gameId: number;
  className?: string;
}

export function PhaseManagement({ gameId, className = '' }: PhaseManagementProps) {
  const [isCreatingPhase, setIsCreatingPhase] = useState(false);
  const [selectedPhaseId, setSelectedPhaseId] = useState<number | null>(null);
  const [isEditingDeadline, setIsEditingDeadline] = useState<number | null>(null);

  const queryClient = useQueryClient();

  const { data: phases = [], isLoading } = useQuery({
    queryKey: ['gamePhases', gameId],
    queryFn: () => apiClient.getGamePhases(gameId).then(res => res.data),
    enabled: !!gameId
  });

  const { data: currentPhaseData } = useQuery({
    queryKey: ['currentPhase', gameId],
    queryFn: () => apiClient.getCurrentPhase(gameId).then(res => res.data),
    enabled: !!gameId
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gamePhases', gameId] });
      queryClient.invalidateQueries({ queryKey: ['currentPhase', gameId] });
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

  const currentPhase = currentPhaseData?.phase;

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
                isActive={currentPhase?.id === phase.id}
                isSelected={selectedPhaseId === phase.id}
                isEditingDeadline={isEditingDeadline === phase.id}
                onSelect={() => setSelectedPhaseId(phase.id)}
                onActivate={() => activatePhaseMutation.mutate(phase.id)}
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
    </div>
  );
}

interface PhaseCardProps {
  phase: GamePhase;
  isActive: boolean;
  isSelected: boolean;
  isEditingDeadline: boolean;
  onSelect: () => void;
  onActivate: () => void;
  onEditDeadline: () => void;
  onUpdateDeadline: (deadline: string) => void;
  onCancelEditDeadline: () => void;
  isActivating: boolean;
  isUpdatingDeadline: boolean;
}

function PhaseCard({
  phase,
  isActive,
  isSelected,
  isEditingDeadline,
  onSelect,
  onActivate,
  onEditDeadline,
  onUpdateDeadline,
  onCancelEditDeadline,
  isActivating,
  isUpdatingDeadline,
}: PhaseCardProps) {
  const [deadlineInput, setDeadlineInput] = useState('');

  const phaseColorClass = PHASE_TYPE_COLORS[phase.phase_type];
  const phaseLabel = PHASE_TYPE_LABELS[phase.phase_type];

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
                onActivate();
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
              onEditDeadline();
              if (phase.deadline) {
                // Convert to local datetime-local format
                const date = new Date(phase.deadline);
                const localDateTime = new Date(date.getTime() - (date.getTimezoneOffset() * 60000))
                  .toISOString()
                  .slice(0, 16);
                setDeadlineInput(localDateTime);
              }
            }}
            className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
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
                <option value="results">Results</option>
              </select>
              <p className="text-sm text-gray-600 mt-1">
                {PHASE_TYPE_DESCRIPTIONS[formData.phase_type]}
              </p>
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
