import { apiClient } from "@/lib/api";
import type { CreateLootTableArgs, UpdateLootTableContentsArgs, UpdateLootTableArgs } from "@/types/games";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export function useLootTableManagement(gameId: number) {
    const queryClient = useQueryClient();

    // Query for all loot tables
    const { data: lootTablesData, isLoading } = useQuery({
        queryKey: ['lootTables', gameId],
        queryFn: () => apiClient.games.getLootTables(gameId).then(res => res.data),
        enabled: !!gameId,
        refetchOnMount: 'always',
        staleTime: 0
    });

    const createLootTableMutation = useMutation({
      mutationFn: (data: CreateLootTableArgs) => apiClient.games.createLootTable(gameId, data),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['lootTables', gameId] });
      }
    });

    const updateLootTableMutation = useMutation({
      mutationFn: (data: UpdateLootTableArgs) => apiClient.games.updateLootTable(gameId, data.id, data),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['lootTables', gameId]})
      }
    });

    const updateLootTableContentsMutation = useMutation({
      mutationFn: (data: UpdateLootTableContentsArgs) => apiClient.games.setLootTableContents(gameId, data.id, data.items),
      onSuccess: (_, v) => {
        queryClient.invalidateQueries({ queryKey: ['lootTableContents', v.id] });
      }
    })

    const deleteLootTableMutation = useMutation({
      mutationFn: (lootTableId: number) => apiClient.games.deleteLootTable(gameId, lootTableId),
      onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['lootTables', gameId] });
      }
    });

    return {
        lootTables: lootTablesData || [],
        isLoading,
        createLootTableMutation,
        updateLootTableMutation,
        deleteLootTableMutation,
        updateLootTableContentsMutation
    }
}