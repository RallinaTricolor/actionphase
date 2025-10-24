import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api';
import { getActionPhaseLabel, getActionPhaseColor } from '../types/phases';
import { CommonRoom } from './CommonRoom';
import { Button } from './ui';

interface PhaseHistoryViewProps {
  gameId: number;
  currentPhaseId?: number;
  isGM?: boolean;
}

export function PhaseHistoryView({ gameId, currentPhaseId, isGM = false }: PhaseHistoryViewProps) {
  const [selectedPhaseId, setSelectedPhaseId] = useState<number | null>(null);

  const { data: phasesData, isLoading } = useQuery({
    queryKey: ['gamePhases', gameId],
    queryFn: () => apiClient.phases.getGamePhases(gameId).then(res => res.data),
    enabled: !!gameId,
  });

  const phases = phasesData || [];

  // Get the selected phase details
  const selectedPhase = phases.find(p => p.id === selectedPhaseId);

  if (isLoading) {
    return (
      <div className="surface-base rounded-lg shadow-md p-6">
        <div className="animate-pulse">
          <div className="h-6 surface-raised rounded mb-4 w-1/3"></div>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 surface-raised rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (selectedPhaseId && selectedPhase) {
    // Show Common Room for selected phase only if it's a common_room phase
    return (
      <div>
        <Button
          variant="ghost"
          onClick={() => setSelectedPhaseId(null)}
          className="mb-4 flex items-center text-interactive-primary hover:text-interactive-primary-hover"
        >
          <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Phase History
        </Button>
        {selectedPhase.phase_type === 'common_room' ? (
          <CommonRoom
            gameId={gameId}
            phaseId={selectedPhaseId}
            phaseTitle={selectedPhase.title || getActionPhaseLabel(selectedPhase)}
            isCurrentPhase={selectedPhaseId === currentPhaseId}
            isGM={isGM}
          />
        ) : (
          <div className="surface-base rounded-lg shadow-md p-8 text-center">
            <svg className="w-12 h-12 mx-auto mb-3 text-content-tertiary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="text-lg font-medium text-content-primary mb-2">Action Phase</h3>
            <p className="text-content-secondary">
              This was an action phase. Common Room discussions are only available for common_room phases.
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="surface-base rounded-lg shadow-md p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-content-primary mb-2">Phase History</h2>
        <p className="text-content-secondary">
          View Common Room discussions from previous phases
        </p>
      </div>

      {phases.length === 0 ? (
        <div className="text-center py-8 text-content-tertiary">
          <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p>No phases yet</p>
          <p className="text-sm">Phases will appear here as they are created</p>
        </div>
      ) : (
        <div className="space-y-3">
          {phases.map((phase) => {
            const phaseLabel = getActionPhaseLabel(phase);
            const phaseColorClass = getActionPhaseColor(phase);
            const isActive = phase.id === currentPhaseId;
            const isCommonRoom = phase.phase_type === 'common_room';

            // Action phases have no content to display, so they should not be clickable
            if (!isCommonRoom) {
              return (
                <div
                  key={phase.id}
                  className={`w-full border rounded-lg p-4 opacity-60 cursor-not-allowed ${
                    isActive ? 'border-interactive-primary bg-interactive-primary-subtle' : 'border-theme-subtle'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <span className={`px-2 py-1 text-xs rounded-full font-medium border ${phaseColorClass}`}>
                        Phase {phase.phase_number}
                      </span>
                      <div>
                        <h4 className="font-medium text-content-primary">{phase.title || phaseLabel}</h4>
                        {phase.description && (
                          <p className="text-sm text-content-secondary mt-1">{phase.description}</p>
                        )}
                        <p className="text-xs text-content-tertiary mt-1 italic">
                          (No viewable content for action phases)
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      {isActive && (
                        <span className="px-2 py-1 text-xs bg-interactive-primary-subtle text-interactive-primary rounded-full font-medium">
                          Active
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            }

            return (
              <Button
                key={phase.id}
                variant="ghost"
                onClick={() => setSelectedPhaseId(phase.id)}
                className={`w-full text-left border rounded-lg p-4 hover:border-theme-subtle ${
                  isActive ? 'border-interactive-primary bg-interactive-primary-subtle' : 'border-theme-default'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <span className={`px-2 py-1 text-xs rounded-full font-medium border ${phaseColorClass}`}>
                      Phase {phase.phase_number}
                    </span>
                    <div>
                      <h4 className="font-medium text-content-primary">{phase.title || phaseLabel}</h4>
                      {phase.description && (
                        <p className="text-sm text-content-secondary mt-1">{phase.description}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    {isActive && (
                      <span className="px-2 py-1 text-xs bg-interactive-primary-subtle text-interactive-primary rounded-full font-medium">
                        Active
                      </span>
                    )}
                    <svg className="w-5 h-5 text-content-tertiary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </Button>
            );
          })}
        </div>
      )}
    </div>
  );
}
