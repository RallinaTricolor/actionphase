import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api';
import type { ActionResult, StagedResultPart } from '../types/phases';
import { invalidateScoreboards } from './useScoreboard';

export function useUserActionResults(gameId: number) {
  return useQuery({
    queryKey: ['actionResults', 'user', gameId],
    queryFn: async () => {
      const response = await apiClient.phases.getUserResults(gameId);
      return response.data;
    },
    enabled: !!gameId,
  });
}

export function useGameActionResults(gameId: number, options: { refetchInterval?: number | false } = {}) {
  return useQuery({
    queryKey: ['actionResults', 'game', gameId],
    queryFn: async () => {
      const response = await apiClient.phases.getGameResults(gameId);
      return response.data;
    },
    enabled: !!gameId,
    refetchInterval: options.refetchInterval,
  });
}

/**
 * Who has an unpublished result (or part) with nothing written in it, in the
 * phase. The server refuses to publish those, so the Publish all dialogs say
 * so first.
 */
export function useBlankDraftRecipients(gameId: number, phaseId: number | undefined, enabled = true): string[] {
  const { data } = useGameActionResults(gameId);
  if (!enabled || phaseId === undefined) return [];
  const blank = (data ?? []).filter((r) => r.phase_id === phaseId && !r.is_published && !r.content.trim());
  return [...new Set(blank.map((r) => r.character_name || r.username || `User ${r.user_id}`))];
}

export function useCreateActionResult(gameId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { user_id: number; character_id?: number; action_submission_id?: number; content: string; is_published?: boolean }) => {
      const response = await apiClient.phases.createActionResult(gameId, data);
      return response.data;
    },
    onSuccess: () => {
      // Invalidate action results queries to refetch
      queryClient.invalidateQueries({ queryKey: ['actionResults', 'game', gameId] });
      queryClient.invalidateQueries({ queryKey: ['actionResults', 'user', gameId] });
      queryClient.invalidateQueries({ queryKey: ['unpublishedResultsCount'] });
    },
  });
}

/**
 * Creates a staged result chain: several linked parts revealed on a timer.
 *
 * Invalidates the same query keys as useCreateActionResult — a chain lands in
 * the same result lists as any other result, and its head is immediately
 * visible when the chain is published.
 */
export function useCreateStagedResultChain(gameId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      user_id: number;
      character_id?: number;
      action_submission_id?: number;
      parts: StagedResultPart[];
      is_published?: boolean;
    }) => {
      const response = await apiClient.phases.createStagedResultChain(gameId, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['actionResults', 'game', gameId] });
      queryClient.invalidateQueries({ queryKey: ['actionResults', 'user', gameId] });
      queryClient.invalidateQueries({ queryKey: ['unpublishedResultsCount'] });
    },
  });
}

/**
 * Appends one part to the end of a draft chain.
 *
 * This is the "write it over several sittings" path: a GM saves an opening
 * beat and comes back later to add the payoff. resultId may be any member of
 * the chain, and a plain unstaged draft is a chain of one, so the same call
 * also converts a draft into a staged chain.
 *
 * Invalidates unpublishedResultsCount alongside the result lists: appending
 * creates a new unpublished row, so the GM's "N results waiting" badge is now
 * stale. The chain's sheet updates move to the new last part, so their counts
 * go too.
 */
export function useAppendStagedPart(gameId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ resultId, part }: { resultId: number; part: StagedResultPart }) => {
      const response = await apiClient.phases.appendStagedPart(gameId, resultId, part);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['actionResults', 'game', gameId] });
      queryClient.invalidateQueries({ queryKey: ['actionResults', 'user', gameId] });
      queryClient.invalidateQueries({ queryKey: ['unpublishedResultsCount'] });
      queryClient.invalidateQueries({ queryKey: ['draftUpdateCount', gameId] });
      queryClient.invalidateQueries({ queryKey: ['phaseDraftUpdates', gameId] });
    },
  });
}

/**
 * Retimes a staged part that has not yet been revealed.
 *
 * Also invalidates the player-facing list: retiming a *published* pending part
 * changes the unlocks_at the recipient's countdown is rendering, so leaving
 * that cache alone would leave the player counting down to the old time.
 *
 * Does not touch unpublishedResultsCount — a retime never changes how many
 * results are waiting to be published.
 */
export function useUpdateStagedPartDelay(gameId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ resultId, delayMinutes }: { resultId: number; delayMinutes: number }) => {
      const response = await apiClient.phases.updateStagedPartDelay(gameId, resultId, delayMinutes);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['actionResults', 'game', gameId] });
      queryClient.invalidateQueries({ queryKey: ['actionResults', 'user', gameId] });
    },
  });
}

/**
 * Cancels a staged part that has not yet been revealed: a published part
 * waiting on its timer, or a part of a draft chain. Cancelling a draft part
 * changes the unpublished count, and its sheet updates move to the part that is
 * now last, so those counts are refreshed too.
 */
export function useCancelPendingStagedPart(gameId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (resultId: number) => {
      await apiClient.phases.cancelPendingStagedPart(gameId, resultId);
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['actionResults', 'user', gameId] });
      await queryClient.invalidateQueries({ queryKey: ['actionResults', 'game', gameId] });
      queryClient.invalidateQueries({ queryKey: ['unpublishedResultsCount'] });
      // Only the parts that are left: a card still shows the cancelled part
      // until it re-renders, and refreshing that part's count would be a 404.
      const results = queryClient.getQueryData<ActionResult[]>(['actionResults', 'game', gameId]);
      const remaining = results && new Set<unknown>(results.map((r) => r.id));
      queryClient.invalidateQueries({
        queryKey: ['draftUpdateCount', gameId],
        predicate: (query) => !remaining || remaining.has(query.queryKey[2]),
      });
      queryClient.invalidateQueries({ queryKey: ['phaseDraftUpdates', gameId] });
    },
  });
}

export function useUpdateActionResult(gameId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ resultId, content }: { resultId: number; content: string }) => {
      const response = await apiClient.phases.updateActionResult(gameId, resultId, { content });
      return response.data;
    },
    onSuccess: () => {
      // Invalidate action results queries to refetch
      queryClient.invalidateQueries({ queryKey: ['actionResults', 'game', gameId] });
      queryClient.invalidateQueries({ queryKey: ['actionResults', 'user', gameId] });
    },
  });
}

export function useDeleteActionResult(gameId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (resultId: number) => {
      await apiClient.phases.deleteActionResult(gameId, resultId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['actionResults', 'game', gameId] });
      queryClient.invalidateQueries({ queryKey: ['actionResults', 'user', gameId] });
      queryClient.invalidateQueries({ queryKey: ['unpublishedResultsCount'] });
    },
  });
}

export function usePublishActionResult(gameId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (resultId: number) => {
      const response = await apiClient.phases.publishActionResult(gameId, resultId);
      return response.data;
    },
    onSuccess: () => {
      // Invalidate queries to refetch data
      queryClient.invalidateQueries({ queryKey: ['actionResults', 'game', gameId] });
      queryClient.invalidateQueries({ queryKey: ['actionResults', 'user', gameId] });
      queryClient.invalidateQueries({ queryKey: ['unpublishedResultsCount'] });
      queryClient.invalidateQueries({ queryKey: ['draftCharacterUpdates'] });
      queryClient.invalidateQueries({ queryKey: ['draftUpdateCount'] });
      queryClient.invalidateQueries({ queryKey: ['phaseDraftUpdates', gameId] });
      // Invalidate character data to show published character updates: one
      // sheet at a time, and the whole game's (the results board reads that).
      queryClient.invalidateQueries({ queryKey: ['characterData'] });
      queryClient.invalidateQueries({ queryKey: ['gameCharacterData', gameId] });
      invalidateScoreboards(queryClient, gameId);
    },
  });
}

/**
 * Publishes every draft result in a phase (chain heads publish their whole
 * chain). Shared by the results list and the results board.
 */
export function usePublishAllPhaseResults(gameId: number, phaseId: number | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!phaseId) throw new Error('No phase to publish');
      await apiClient.phases.publishAllPhaseResults(gameId, phaseId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unpublishedResultsCount', gameId, phaseId] });
      queryClient.invalidateQueries({ queryKey: ['actionResults', 'game', gameId] });
      queryClient.invalidateQueries({ queryKey: ['actionResults', 'user', gameId] });
      queryClient.invalidateQueries({ queryKey: ['draftCharacterUpdates'] });
      queryClient.invalidateQueries({ queryKey: ['draftUpdateCount'] });
      queryClient.invalidateQueries({ queryKey: ['phaseDraftUpdates', gameId] });
      // Published sheet updates change character data.
      queryClient.invalidateQueries({ queryKey: ['characterData'] });
      queryClient.invalidateQueries({ queryKey: ['gameCharacterData', gameId] });
      invalidateScoreboards(queryClient, gameId);
    },
  });
}
