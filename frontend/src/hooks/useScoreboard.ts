import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { apiClient } from '@/lib/api';
import type { ScoreboardConfig } from '@/types/scoreboard';

export const scoreboardQueryKey = (gameId: number) => ['scoreboard', gameId] as const;
export const scoreboardConfigQueryKey = (gameId: number) => ['scoreboardConfig', gameId] as const;
export const scoreboardEntryNamesQueryKey = (gameId: number) => ['scoreboardEntryNames', gameId] as const;
const scoreboardPreviewQueryKey =(gameId: number, config: ScoreboardConfig) =>
  ['scoreboardPreview', gameId, config] as const;

/**
 * Call after anything the board is built from changes: sheet values, who is on
 * it, their names and avatars, the sheet layout or the game's state. The editor's
 * entry names come from the same sheets. Without a game id, every game's board
 * is refreshed, for the few callers that only know the character.
 */
export function invalidateScoreboards(queryClient: QueryClient, gameId?: number) {
  const scope = gameId === undefined ? [] : [gameId];
  void queryClient.invalidateQueries({ queryKey: ['scoreboard', ...scope] });
  void queryClient.invalidateQueries({ queryKey: ['scoreboardEntryNames', ...scope] });
}

interface ScoreboardQueryOptions {
  enabled?: boolean;
}

const isValidGameId = (gameId: number) => Number.isFinite(gameId) && gameId > 0;

/**
 * The board as this viewer may see it. `null` means there is no board for them:
 * the tab is decided from the game's settings, which can be out of date (the GM
 * just made the board private), and the server answers 404 then.
 */
export function useScoreboard(gameId: number, { enabled = true }: ScoreboardQueryOptions = {}) {
  return useQuery({
    queryKey: scoreboardQueryKey(gameId),
    queryFn: async () => {
      try {
        const response = await apiClient.scoreboard.getScoreboard(gameId);
        return response.data;
      } catch (error) {
        if (isAxiosError(error) && error.response?.status === 404) return null;
        throw error;
      }
    },
    enabled: enabled && isValidGameId(gameId),
  });
}

/** The stored setup. GM only, so callers pass `enabled` for the GM. */
export function useScoreboardConfig(gameId: number, { enabled = true }: ScoreboardQueryOptions = {}) {
  return useQuery({
    queryKey: scoreboardConfigQueryKey(gameId),
    queryFn: () => apiClient.scoreboard.getConfig(gameId).then((response) => response.data),
    enabled: enabled && isValidGameId(gameId),
  });
}

/** Entry names for the column picker. GM only, like the setup. */
export function useScoreboardEntryNames(gameId: number, { enabled = true }: ScoreboardQueryOptions = {}) {
  return useQuery({
    queryKey: scoreboardEntryNamesQueryKey(gameId),
    queryFn: () => apiClient.scoreboard.getEntryNames(gameId).then((response) => response.data),
    enabled: enabled && isValidGameId(gameId),
  });
}

/**
 * What players would get from an unsaved setup. Never retried or kept: a refusal
 * names a problem in the draft, and the next draft is a different question.
 */
export function useScoreboardPreview(gameId: number, config: ScoreboardConfig) {
  return useQuery({
    queryKey: scoreboardPreviewQueryKey(gameId, config),
    queryFn: () => apiClient.scoreboard.previewScoreboard(gameId, config).then((response) => response.data),
    enabled: isValidGameId(gameId),
    retry: false,
    gcTime: 0,
  });
}

/**
 * Saves the setup. The saved board can differ for everyone, and the game's
 * details carry its visibility, which decides who gets the tab.
 */
export function useUpdateScoreboardConfig(gameId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (config: ScoreboardConfig) =>
      apiClient.scoreboard.updateConfig(gameId, config).then((response) => response.data),
    onSuccess: (saved) => {
      queryClient.setQueryData(scoreboardConfigQueryKey(gameId), saved);
      void queryClient.invalidateQueries({ queryKey: scoreboardQueryKey(gameId) });
      void queryClient.invalidateQueries({ queryKey: ['gameDetails', gameId] });
    },
  });
}
