import type { QueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import type { ActionResult } from '@/types/phases';

export interface FirstDraftRequest {
  phase_id: number;
  user_id: number;
  character_id: number;
  action_submission_id?: number;
  content: string;
}

const inFlight = new WeakMap<QueryClient, Map<string, Promise<ActionResult>>>();

/** Puts a result the server just returned in the results list, so nothing acts on a list without it. */
export function addResultToCache(qc: QueryClient, gameId: number, result: ActionResult) {
  qc.setQueryData<ActionResult[]>(['actionResults', 'game', gameId], (old) => (!old || old.some((r) => r.id === result.id) ? old : [...old, result]));
  void qc.invalidateQueries({ queryKey: ['actionResults', 'game', gameId] });
  void qc.invalidateQueries({ queryKey: ['unpublishedResultsCount'] });
}

/**
 * The character's draft for this phase, made if they have none. The result
 * editor and the rewards panel both start one, so callers here at the same
 * time share a single request, and the server hands back a draft that already
 * exists (a co-GM's, say) instead of making a second. It may therefore come
 * back with someone else's text: compare before assuming it holds yours.
 */
export function createFirstDraft(qc: QueryClient, gameId: number, request: FirstDraftRequest): Promise<ActionResult> {
  let requests = inFlight.get(qc);
  if (!requests) {
    requests = new Map();
    inFlight.set(qc, requests);
  }
  const live = requests;
  const key = `${gameId}:${request.phase_id}:${request.character_id}`;
  const running = live.get(key);
  if (running) return running;

  const made = apiClient.phases
    .createActionResult(gameId, { ...request, first_draft: true })
    .then(({ data }) => {
      const result: ActionResult = { ...data, character_id: request.character_id };
      addResultToCache(qc, gameId, result);
      return result;
    })
    .finally(() => live.delete(key));
  live.set(key, made);
  return made;
}
