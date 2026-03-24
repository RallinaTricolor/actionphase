import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api';

export function useCharacterStats(characterId: number | undefined) {
  return useQuery({
    queryKey: ['characterStats', characterId],
    queryFn: () =>
      apiClient.characters.getCharacterStats(characterId!).then((r) => r.data),
    enabled: !!characterId,
    staleTime: 60_000,
  });
}
