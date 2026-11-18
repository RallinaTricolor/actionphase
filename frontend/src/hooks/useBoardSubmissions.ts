import { useQuery } from '@tanstack/react-query';
import { useBoardReadOnly } from '@/hooks/useBoardReadOnly';
import { apiClient } from '@/lib/api';
import type { ActionWithDetails } from '@/types/phases';

/** One page holds a phase's submissions (as in the History tab). */
const VIEWER_PAGE = 200;

/**
 * The submissions the results board reads. A GM editing the board gets the
 * game's list (every phase). A read-only board can't count on that endpoint,
 * which is GM only: viewers the board is shared with read the audience
 * listing for this phase instead, which runs the same query with the same
 * columns (the GM of an archived game passes it too). The query key matches
 * the History tab's, so the two share a cache.
 */
export function useBoardSubmissions(gameId: number, phaseId: number) {
  const readOnly = useBoardReadOnly();
  const gm = useQuery<ActionWithDetails[]>({
    queryKey: ['gameActions', gameId],
    queryFn: () => apiClient.phases.getGameActions(gameId).then((res) => res.data),
    enabled: !readOnly && gameId > 0,
  });
  const viewer = useQuery<ActionWithDetails[]>({
    queryKey: ['audienceActions', gameId, phaseId],
    queryFn: () =>
      apiClient.games
        .listAllActionSubmissions(gameId, { phaseId, limit: VIEWER_PAGE })
        .then((res) => res.data.action_submissions ?? []),
    enabled: readOnly && gameId > 0 && phaseId > 0,
  });
  return readOnly ? viewer : gm;
}
