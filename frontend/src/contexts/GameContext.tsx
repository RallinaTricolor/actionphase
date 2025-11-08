import React, { createContext, useContext, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api';
import type { GameWithDetails, GameParticipant } from '../types/games';
import type { Character } from '../types/characters';
import { useAuth } from './AuthContext';
import { useAdminMode } from './AdminModeContext';
import { logger } from '@/services/LoggingService';

export type UserGameRole = 'gm' | 'player' | 'co_gm' | 'audience' | 'none';

interface GameContextValue {
  // Game data
  gameId: number;
  game: GameWithDetails | null;
  participants: GameParticipant[];

  // Loading states
  isLoadingGame: boolean;
  isLoadingParticipants: boolean;
  isLoadingCharacters: boolean;

  // Current user's role and permissions
  userRole: UserGameRole;
  isGM: boolean;
  isParticipant: boolean;
  canEditGame: boolean;

  // User's characters
  userCharacters: Character[];

  // Character ownership checker
  isUserCharacter: (characterId: number) => boolean;

  // Refresh function
  refetchGameData: () => Promise<void>;
}

const GameContext = createContext<GameContextValue | undefined>(undefined);

interface GameProviderProps {
  gameId: number;
  children: React.ReactNode;
}

export function GameProvider({ gameId, children }: GameProviderProps) {
  const { currentUser } = useAuth();
  const { adminModeEnabled } = useAdminMode();
  const currentUserId = currentUser?.id;

  // Fetch game details
  const {
    data: game,
    isLoading: isLoadingGame,
    refetch: refetchGame,
  } = useQuery({
    queryKey: ['gameDetails', gameId],
    queryFn: async () => {
      logger.debug('Fetching game details', { gameId });
      const response = await apiClient.games.getGameWithDetails(gameId);
      logger.debug('Game details loaded', { gameId, gameTitle: response.data.title, state: response.data.state });
      return response.data;
    },
    enabled: !!gameId,
    staleTime: 30000, // Cache for 30 seconds
  });

  // Fetch game participants
  const {
    data: participants,
    isLoading: isLoadingParticipants,
    refetch: refetchParticipants,
  } = useQuery({
    queryKey: ['gameParticipants', gameId],
    queryFn: async () => {
      logger.debug('Fetching game participants', { gameId });
      const response = await apiClient.games.getGameParticipants(gameId);
      logger.debug('Participants loaded', { gameId, participantCount: response.data?.length || 0 });
      return response.data || [];
    },
    enabled: !!gameId,
    staleTime: 30000,
  });

  // Fetch user's controllable characters
  const {
    data: userCharacters,
    isLoading: isLoadingCharacters,
    refetch: refetchCharacters,
  } = useQuery({
    queryKey: ['userControllableCharacters', gameId],
    queryFn: async () => {
      logger.debug('Fetching controllable characters', { gameId, currentUserId });
      const response = await apiClient.characters.getUserControllableCharacters(gameId);
      logger.debug('User characters loaded', { gameId, characterCount: response.data?.length || 0 });
      return response.data || [];
    },
    enabled: !!gameId && !!currentUserId,
    staleTime: 30000,
  });

  // Compute user's role
  const userRole: UserGameRole = useMemo(() => {
    if (!currentUserId || !game) return 'none';

    // Check if user is GM
    if (game.gm_user_id === currentUserId) {
      logger.debug('User is GM', { gameId, currentUserId });
      return 'gm';
    }

    // Check participant role
    const participant = participants?.find(p => p.user_id === currentUserId);
    if (participant) {
      logger.debug('User is participant', { gameId, currentUserId, role: participant.role });
      return participant.role as UserGameRole;
    }

    logger.debug('User has no role in game', { gameId, currentUserId });
    return 'none';
  }, [currentUserId, game, participants, gameId]);

  // Compute permission flags
  const isGM = useMemo(() => {
    // User is GM if they own the game, are a co-GM, OR if admin mode is enabled
    const isActualGM = userRole === 'gm' || userRole === 'co_gm';
    const isAdminAsGM = adminModeEnabled && !!currentUser?.is_admin;
    return isActualGM || isAdminAsGM;
  }, [userRole, adminModeEnabled, currentUser?.is_admin]);

  const isParticipant = useMemo((): boolean => {
    return userRole !== 'none' && userRole !== 'audience';
  }, [userRole]);

  // Only primary GM (not co-GM) can edit game settings
  const canEditGame = useMemo((): boolean => {
    const isPrimaryGM = userRole === 'gm';
    const isAdminAsGM = adminModeEnabled && !!currentUser?.is_admin;
    return isPrimaryGM || isAdminAsGM;
  }, [userRole, adminModeEnabled, currentUser?.is_admin]);

  // Character ownership checker
  const isUserCharacter = useMemo(() => {
    const userCharacterIds = new Set(userCharacters?.map(c => c.id) || []);
    return (characterId: number) => userCharacterIds.has(characterId);
  }, [userCharacters]);

  // Refresh all game data
  const refetchGameData = async () => {
    logger.debug('Refetching all game data', { gameId });
    await Promise.all([
      refetchGame(),
      refetchParticipants(),
      refetchCharacters(),
    ]);
  };

  const value: GameContextValue = {
    gameId,
    game: game || null,
    participants: participants || [],
    isLoadingGame,
    isLoadingParticipants,
    isLoadingCharacters,
    userRole,
    isGM,
    isParticipant,
    canEditGame,
    userCharacters: userCharacters || [],
    isUserCharacter,
    refetchGameData,
  };

  logger.debug('GameContext state updated', {
    gameId,
    hasGame: !!game,
    gameState: game?.state,
    participantCount: participants?.length || 0,
    userRole,
    isGM,
    isParticipant,
    userCharacterCount: userCharacters?.length || 0,
    currentUserId,
  });

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGameContext() {
  const context = useContext(GameContext);
  if (context === undefined) {
    throw new Error('useGameContext must be used within a GameProvider');
  }
  return context;
}

// Optional hook that returns null if not in a GameContext
export function useOptionalGameContext() {
  return useContext(GameContext) || null;
}
