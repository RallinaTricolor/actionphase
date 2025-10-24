import { useState } from 'react';
import { SimpleCountdown } from './CountdownTimer';
import { PhaseActivationDialog } from './PhaseActivationDialog';
import { usePhaseActivation } from '../hooks/usePhaseActivation';
import { Button, DateTimeInput } from './ui';
import {
  PHASE_TYPE_DESCRIPTIONS,
  getActionPhaseLabel,
  getActionPhaseColor
} from '../types/phases';
import type { GamePhase } from '../types/phases';

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

export function PhaseCard({
  phase,
  gameId,
  currentPhaseId,
  isActive,
  isSelected,
  isEditingDeadline,
  onSelect,
  onActivate,
  onEdit,
  onEditDeadline: _onEditDeadline,
  onUpdateDeadline,
  onCancelEditDeadline,
  isActivating,
  isUpdatingDeadline,
}: PhaseCardProps) {
  const [deadlineInput, setDeadlineInput] = useState('');
  const [showActivateConfirm, setShowActivateConfirm] = useState(false);

  // Use the activation hook for unpublished results logic
  const { unpublishedCount, publishAllMutation } = usePhaseActivation(
    gameId,
    currentPhaseId,
    showActivateConfirm
  );

  const phaseColorClass = getActionPhaseColor(phase);
  const phaseLabel = getActionPhaseLabel(phase);

  const borderClass = isActive
    ? 'border-interactive-primary bg-interactive-primary-subtle'
    : isSelected
    ? 'border-theme-strong surface-raised'
    : 'border-theme-default hover:border-theme-strong';

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
            <div className="flex items-center gap-2">
              <h4 className="font-medium text-content-primary">{phase.title || phaseLabel}</h4>
              {phase.title && (
                <span className={`px-2 py-0.5 text-xs rounded font-medium ${phaseColorClass}`}>
                  {phaseLabel}
                </span>
              )}
            </div>
            <p className="text-sm text-content-secondary">
              {phase.description || PHASE_TYPE_DESCRIPTIONS[phase.phase_type]}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {phase.deadline && !isEditingDeadline && (
            <SimpleCountdown
              deadline={phase.deadline}
              className="text-content-secondary"
            />
          )}

          {!isActive && (
            <Button
              variant="primary"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setShowActivateConfirm(true);
              }}
              disabled={isActivating}
            >
              {isActivating ? 'Activating...' : 'Activate'}
            </Button>
          )}

          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            className="p-1 text-content-tertiary hover:text-content-primary transition-colors"
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
        <form onSubmit={handleDeadlineSubmit} className="mt-4 pt-4 border-t border-theme-default" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-end space-x-2">
            <div className="flex-1">
              <DateTimeInput
                label="Set Deadline"
                value={deadlineInput}
                onChange={(e) => setDeadlineInput(e.target.value)}
                required
              />
            </div>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={isUpdatingDeadline}
            >
              {isUpdatingDeadline ? 'Saving...' : 'Save'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onCancelEditDeadline}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}

      {/* Active Phase Indicator */}
      {isActive && (
        <div className="mt-3 flex items-center text-sm text-interactive-primary">
          <div className="w-2 h-2 bg-interactive-primary rounded-full mr-2"></div>
          Currently Active
        </div>
      )}

      {/* Phase Activation Confirmation Dialog */}
      {showActivateConfirm && (
        <PhaseActivationDialog
          phaseNumber={phase.phase_number}
          currentPhaseId={currentPhaseId}
          unpublishedCount={unpublishedCount}
          isActivating={isActivating}
          publishAllMutation={publishAllMutation}
          onActivate={onActivate}
          onClose={() => setShowActivateConfirm(false)}
        />
      )}
    </div>
  );
}
