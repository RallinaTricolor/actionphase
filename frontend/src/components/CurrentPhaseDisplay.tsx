import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api';
import { CountdownTimer } from './CountdownTimer';
import {
  PHASE_TYPE_LABELS,
  PHASE_TYPE_DESCRIPTIONS,
  PHASE_TYPE_COLORS,
  getActionPhaseLabel,
  getActionPhaseDescription,
  getActionPhaseColor
} from '../types/phases';
import type { GamePhase } from '../types/phases';

interface CurrentPhaseDisplayProps {
  gameId: number;
  isGM?: boolean;
  onPhaseExpired?: () => void;
  className?: string;
}

export function CurrentPhaseDisplay({
  gameId,
  isGM = false,
  onPhaseExpired,
  className = ''
}: CurrentPhaseDisplayProps) {
  const [showPreviousPhases, setShowPreviousPhases] = useState(false);

  const { data: currentPhaseData, isLoading, error } = useQuery({
    queryKey: ['currentPhase', gameId],
    queryFn: () => apiClient.getCurrentPhase(gameId).then(res => res.data),
    refetchInterval: 30000, // Refetch every 30 seconds
    refetchOnMount: 'always',
    staleTime: 0,
    enabled: !!gameId
  });

  // Get all phases for history
  const { data: allPhasesData } = useQuery({
    queryKey: ['gamePhases', gameId],
    queryFn: () => apiClient.getGamePhases(gameId).then(res => res.data),
    enabled: !!gameId && !isGM, // Only fetch for non-GM users
    refetchOnMount: 'always',
    staleTime: 0
  });

  if (isLoading) {
    return (
      <div className={`bg-white rounded-lg border border-gray-200 p-4 animate-pulse ${className}`}>
        <div className="h-6 bg-gray-200 rounded mb-2 w-1/3"></div>
        <div className="h-4 bg-gray-200 rounded mb-2 w-2/3"></div>
        <div className="h-8 bg-gray-200 rounded w-1/4"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-red-50 border border-red-200 rounded-lg p-4 ${className}`}>
        <div className="flex items-center">
          <svg className="w-5 h-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-red-700 text-sm">Failed to load current phase</span>
        </div>
      </div>
    );
  }

  const currentPhase = currentPhaseData?.phase;
  const allPhases = allPhasesData || [];
  // Only show phases that have ended (have end_time) or are not active
  // This filters out future phases that haven't been activated yet
  const previousPhases = allPhases.filter(phase =>
    !phase.is_active &&
    phase.id !== currentPhase?.id &&
    (phase.end_time || phase.phase_number < (currentPhase?.phase_number || 0))
  );

  if (!currentPhase) {
    return (
      <div className={`bg-gray-50 border border-gray-200 rounded-lg p-6 text-center ${className}`}>
        <div className="text-gray-500 mb-2">
          <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-1">No Active Phase</h3>
        <p className="text-sm text-gray-500">
          {isGM
            ? 'Create a new phase to begin the game session.'
            : 'Waiting for the GM to start the next phase.'
          }
        </p>
      </div>
    );
  }

  return (
    <div className={className}>
      <CurrentPhaseCard
        phase={currentPhase}
        isGM={isGM}
        onPhaseExpired={onPhaseExpired}
      />

      {/* Previous Phases Section (Non-GM only) */}
      {!isGM && previousPhases.length > 0 && (
        <div className="mt-4 bg-white rounded-lg border border-gray-200">
          <button
            onClick={() => setShowPreviousPhases(!showPreviousPhases)}
            className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center">
              <svg className="w-5 h-5 text-gray-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="text-md font-medium text-gray-900">
                Previous Phases ({previousPhases.length})
              </h3>
            </div>
            <svg
              className={`w-5 h-5 text-gray-400 transition-transform ${showPreviousPhases ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showPreviousPhases && (
            <div className="border-t border-gray-200 p-4">
              <div className="space-y-3">
                {previousPhases.map((phase) => (
                  <PreviousPhaseCard key={phase.id} phase={phase} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface CurrentPhaseCardProps {
  phase: GamePhase;
  isGM?: boolean;
  onPhaseExpired?: () => void;
  className?: string;
}

function CurrentPhaseCard({
  phase,
  isGM = false,
  onPhaseExpired,
  className = ''
}: CurrentPhaseCardProps) {
  const phaseColorClass = getActionPhaseColor(phase);
  const phaseLabel = getActionPhaseLabel(phase);
  const phaseDescription = getActionPhaseDescription(phase);

  const phaseIcon = getPhaseIcon(phase);

  return (
    <div className={`bg-white rounded-lg border-2 shadow-sm ${className}`}>
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center">
            <div className="flex-shrink-0 mr-3">
              {phaseIcon}
            </div>
            <div>
              <div className="flex items-center space-x-2 mb-1">
                <h3 className="text-lg font-semibold text-gray-900">
                  {phaseLabel}
                </h3>
                <span className={`px-2 py-1 text-xs rounded-full font-medium border ${phaseColorClass}`}>
                  Phase {phase.phase_number}
                </span>
              </div>
              <p className="text-sm text-gray-600">{phaseDescription}</p>
            </div>
          </div>

          {phase.deadline && (
            <CountdownTimer
              deadline={phase.deadline}
              onExpired={onPhaseExpired}
              className="flex-shrink-0"
            />
          )}
        </div>

        {/* Phase-specific information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-100">
          <div>
            <span className="text-sm font-medium text-gray-700">Started:</span>
            <div className="text-sm text-gray-900">
              {new Date(phase.start_time).toLocaleString()}
            </div>
          </div>

          {phase.deadline && (
            <div>
              <span className="text-sm font-medium text-gray-700">Deadline:</span>
              <div className="text-sm text-gray-900">
                {new Date(phase.deadline).toLocaleString()}
              </div>
            </div>
          )}
        </div>

        {/* Phase-specific actions */}
        <PhaseActions phase={phase} isGM={isGM} />
      </div>
    </div>
  );
}

interface PhaseActionsProps {
  phase: GamePhase;
  isGM: boolean;
}

function PhaseActions({ phase, isGM }: PhaseActionsProps) {
  if (phase.phase_type === 'action') {
    // Action phase with published results
    if (phase.is_published) {
      return (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <p className="text-sm text-purple-700 font-medium">
            {isGM
              ? 'Results have been published to all players.'
              : 'The GM has published the results of your actions.'
            }
          </p>
        </div>
      );
    }

    // Action phase still accepting submissions
    return (
      <div className="mt-4 pt-4 border-t border-gray-100">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div className="mb-2 sm:mb-0">
            <p className="text-sm text-blue-700 font-medium">
              {isGM
                ? 'Players are submitting their actions privately.'
                : 'Submit your action before the deadline.'
              }
            </p>
          </div>
          {!isGM && (
            <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors">
              Submit Action
            </button>
          )}
        </div>
      </div>
    );
  }

  if (phase.phase_type === 'common_room') {
    return (
      <div className="mt-4 pt-4 border-t border-gray-100">
        <p className="text-sm text-green-700 font-medium">
          {isGM
            ? 'Players can discuss and roleplay freely.'
            : 'Discuss and interact with other players.'
          }
        </p>
      </div>
    );
  }

  return null;
}

function getPhaseIcon(phase: GamePhase) {
  const iconClass = "w-8 h-8";

  // Check if action phase with published results
  if (phase.phase_type === 'action' && phase.is_published) {
    return (
      <div className="p-2 bg-purple-100 rounded-lg">
        <svg className={`${iconClass} text-purple-600`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
    );
  }

  switch (phase.phase_type) {
    case 'common_room':
      return (
        <div className="p-2 bg-green-100 rounded-lg">
          <svg className={`${iconClass} text-green-600`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
          </svg>
        </div>
      );

    case 'action':
      return (
        <div className="p-2 bg-blue-100 rounded-lg">
          <svg className={`${iconClass} text-blue-600`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
      );

    default:
      return (
        <div className="p-2 bg-gray-100 rounded-lg">
          <svg className={`${iconClass} text-gray-600`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
      );
  }
}

interface PreviousPhaseCardProps {
  phase: GamePhase;
}

function PreviousPhaseCard({ phase }: PreviousPhaseCardProps) {
  const phaseColorClass = getActionPhaseColor(phase);
  const phaseLabel = getActionPhaseLabel(phase);

  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <span className={`px-2 py-1 text-xs rounded-full font-medium border ${phaseColorClass}`}>
            Phase {phase.phase_number}
          </span>
          <div>
            <h4 className="font-medium text-gray-900 text-sm">{phaseLabel}</h4>
            <p className="text-xs text-gray-600">
              {new Date(phase.start_time).toLocaleDateString()} •
              {phase.end_time ? ` Ended ${new Date(phase.end_time).toLocaleDateString()}` : ' Completed'}
            </p>
          </div>
        </div>
        <span className="px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded">
          Completed
        </span>
      </div>
    </div>
  );
}
