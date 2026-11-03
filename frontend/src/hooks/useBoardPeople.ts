import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useGameContext } from '@/contexts/GameContext';
import { useGmSettings } from '@/hooks/useGmBoard';
import { apiClient } from '@/lib/api';
import { boardCast, canReadRule } from '@/lib/gmBoard/cast';
import { characterNames } from '@/lib/gmBoard/text';

/**
 * Who the board is about, for one action phase: the cast, everyone's names
 * (including people with a submission and no character record any more),
 * the names text is matched by, who submitted and what (and the submission's
 * id), and who can read moments (who gets results).
 */
export function useBoardPeople(gameId: number, phaseId: number) {
  const { allGameCharacters } = useGameContext();
  const { settings } = useGmSettings(gameId);
  const actions = useQuery({
    queryKey: ['gameActions', gameId],
    queryFn: () => apiClient.phases.getGameActions(gameId).then((res) => res.data),
    enabled: gameId > 0,
  });

  const cast = useMemo(() => boardCast(allGameCharacters), [allGameCharacters]);
  const names = useMemo(() => {
    const m = new Map(cast.map((c) => [c.id, c.name]));
    for (const a of actions.data ?? []) if (a.character_id && !m.has(a.character_id)) m.set(a.character_id, a.character_name ?? `Character ${a.character_id}`);
    return m;
  }, [cast, actions.data]);
  const submissions = useMemo(() => {
    const out = new Map<number, string>();
    for (const a of actions.data ?? []) if (a.phase_id === phaseId && a.character_id) out.set(a.character_id, a.content);
    return out;
  }, [actions.data, phaseId]);
  // characterId → their submission's id this phase, which their first result links.
  const submissionIds = useMemo(() => {
    const out = new Map<number, number>();
    for (const a of actions.data ?? []) if (a.phase_id === phaseId && a.character_id) out.set(a.character_id, a.id);
    return out;
  }, [actions.data, phaseId]);
  const submitters = useMemo(() => [...submissions.keys()], [submissions]);
  const nameLists = useMemo(
    () => new Map([...names].map(([id, name]) => [id, characterNames(settings?.names ?? {}, id, name)])),
    [names, settings?.names],
  );
  const canRead = useMemo(() => canReadRule(cast), [cast]);

  return { cast, names, nameLists, submissions, submissionIds, submitters, canRead, settings, isLoading: actions.isLoading || !settings, error: actions.error };
}
