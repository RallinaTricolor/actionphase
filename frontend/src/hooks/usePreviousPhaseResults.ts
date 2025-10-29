import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api';
import type { ActionResult, GamePhase } from '../types/phases';

interface PreviousPhaseResultsData {
  shouldShowResults: boolean;
  results: ActionResult[];
  previousPhaseId: number | null;
  previousPhaseTitle: string | null;
}

/**
 * Hook to fetch and manage previous phase action results
 *
 * Shows results when:
 * - Current phase is common_room
 * - Previous phase was action with published results
 * - No new action phase has started since
 *
 * @param gameId - The game ID
 * @param currentPhase - The current active phase (if any)
 * @param isGM - Whether the current user is the GM
 * @returns Data about previous phase results and whether to show them
 */
export function usePreviousPhaseResults(
  gameId: number,
  currentPhase: GamePhase | null | undefined,
  isGM: boolean = false
): PreviousPhaseResultsData {
  // Fetch all game phases
  const { data: phases } = useQuery({
    queryKey: ['gamePhases', gameId],
    queryFn: () => apiClient.phases.getGamePhases(gameId).then(res => res.data),
    enabled: !!gameId,
  });

  // Fetch action results (use appropriate endpoint based on role)
  const { data: results } = useQuery({
    queryKey: ['actionResults', isGM ? 'game' : 'user', gameId],
    queryFn: async () => {
      const response = isGM
        ? await apiClient.phases.getGameResults(gameId)
        : await apiClient.phases.getUserResults(gameId);
      return response.data;
    },
    enabled: !!gameId,
  });

  // Determine if we should show recent results
  const previousPhaseData = useMemo(() => {
    // Default return value (don't show)
    const defaultReturn: PreviousPhaseResultsData = {
      shouldShowResults: false,
      results: [],
      previousPhaseId: null,
      previousPhaseTitle: null,
    };

    // Must have current phase, phases list, and results
    if (!currentPhase || !phases || !results) {
      return defaultReturn;
    }

    // Current phase must be common_room
    if (currentPhase.phase_type !== 'common_room') {
      return defaultReturn;
    }

    // Sort phases by phase_number to find previous phase
    const sortedPhases = [...phases].sort((a, b) => a.phase_number - b.phase_number);
    const currentPhaseIndex = sortedPhases.findIndex(p => p.id === currentPhase.id);

    // Must have a previous phase
    if (currentPhaseIndex <= 0) {
      return defaultReturn;
    }

    const previousPhase = sortedPhases[currentPhaseIndex - 1];

    // Previous phase must be an action phase
    if (previousPhase.phase_type !== 'action') {
      return defaultReturn;
    }

    // Check if there are any newer action phases after the previous one
    // (If there is, don't show results from the old action phase)
    const hasNewerActionPhase = sortedPhases.some(
      (phase, index) =>
        index > currentPhaseIndex - 1 &&
        index < currentPhaseIndex &&
        phase.phase_type === 'action'
    );

    if (hasNewerActionPhase) {
      return defaultReturn;
    }

    // Filter results for the previous action phase
    // Only show published results (for both players and GMs)
    const previousPhaseResults = results.filter(
      r => r.phase_id === previousPhase.id && r.is_published
    );

    // Must have at least one published result
    if (previousPhaseResults.length === 0) {
      return defaultReturn;
    }

    // All conditions met - show results!
    return {
      shouldShowResults: true,
      results: previousPhaseResults,
      previousPhaseId: previousPhase.id,
      previousPhaseTitle: previousPhase.title || `Phase ${previousPhase.phase_number}`,
    };
  }, [currentPhase, phases, results]);

  return previousPhaseData;
}
