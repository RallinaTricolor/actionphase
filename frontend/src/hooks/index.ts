/**
 * Unified State Management System - Hooks Exports
 *
 * This file exports all custom hooks for easy importing.
 */

// Game-related hooks
export {
  useGamePermissions,
  type GamePermissions,
  type UserGameRole,
} from './useGamePermissions';

export {
  useUserCharacters,
  type UserCharactersResult,
} from './useUserCharacters';

export {
  useCharacterOwnership,
  type CharacterOwnershipResult,
} from './useCharacterOwnership';

export { useGameListing } from './useGameListing';

// Legacy auth hook (deprecated - use useAuth from contexts instead)
export { useAuth as useAuthLegacy, usePing } from './useAuth';

// Admin-related hooks
export { useAdminMode, type UseAdminModeReturn } from './useAdminMode';

// Comment mutation hooks
export { useUpdateComment, useDeleteComment } from './useCommentMutations';

// Recent comments hooks
export { useRecentComments, useTotalCommentCount } from './useRecentComments';

// Draft character updates hooks
export {
  useDraftCharacterUpdates,
  useDraftUpdateCount,
  useCreateDraftCharacterUpdate,
  useUpdateDraftCharacterUpdate,
  useDeleteDraftCharacterUpdate,
} from './useDraftCharacterUpdates';
