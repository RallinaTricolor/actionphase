import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api';

/**
 * Hook for uploading a character avatar
 *
 * Handles:
 * - Multipart form data upload
 * - Automatic query invalidation on success
 * - Error handling
 *
 * @example
 * ```tsx
 * const uploadAvatar = useUploadCharacterAvatar();
 *
 * const handleUpload = (file: File) => {
 *   uploadAvatar.mutate(
 *     { characterId: 123, file },
 *     {
 *       onSuccess: (data) => {
 *         console.log('Avatar uploaded:', data.avatar_url);
 *       },
 *       onError: (error) => {
 *         console.error('Upload failed:', error);
 *       }
 *     }
 *   );
 * };
 * ```
 */
export function useUploadCharacterAvatar() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ characterId, file }: { characterId: number; file: File }) =>
      apiClient.characters.uploadCharacterAvatar(characterId, file),
    onSuccess: (_data, variables) => {
      // Invalidate character queries to refetch with new avatar
      queryClient.invalidateQueries({ queryKey: ['character', variables.characterId] });
      queryClient.invalidateQueries({ queryKey: ['characters'] });
    },
  });
}

/**
 * Hook for deleting a character avatar
 *
 * Handles:
 * - Avatar deletion
 * - Automatic query invalidation on success
 * - Error handling
 *
 * @example
 * ```tsx
 * const deleteAvatar = useDeleteCharacterAvatar();
 *
 * const handleDelete = () => {
 *   if (confirm('Are you sure you want to remove this avatar?')) {
 *     deleteAvatar.mutate(123, {
 *       onSuccess: () => {
 *         console.log('Avatar deleted');
 *       }
 *     });
 *   }
 * };
 * ```
 */
export function useDeleteCharacterAvatar() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (characterId: number) =>
      apiClient.characters.deleteCharacterAvatar(characterId),
    onSuccess: (_, characterId) => {
      // Invalidate character queries to refetch without avatar
      queryClient.invalidateQueries({ queryKey: ['character', characterId] });
      queryClient.invalidateQueries({ queryKey: ['characters'] });
    },
  });
}
