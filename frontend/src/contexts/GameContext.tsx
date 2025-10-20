import React, { createContext, useContext, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api';
import type { GameWithDetails, GameParticipant } from '../types/games';
import type { Character } from '../types/characters';
import { useAuth } from './AuthContext';

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
  const currentUserId = currentUser?.id;

  // Fetch game details
  const {
    data: game,
    isLoading: isLoadingGame,
    refetch: refetchGame,
  } = useQuery({
    queryKey: ['gameDetails', gameId],
    queryFn: async () => {
      console.log('[GameContext] Fetching game details for gameId:', gameId);
      const response = await apiClient.games.getGameWithDetails(gameId);
      console.log('[GameContext] Game details loaded:', response.data);
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
      console.log('[GameContext] Fetching participants for gameId:', gameId);
      const response = await apiClient.games.getGameParticipants(gameId);
      console.log('[GameContext] Participants loaded:', response.data);
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
      console.log('[GameContext] Fetching controllable characters for gameId:', gameId);
      const response = await apiClient.characters.getUserControllableCharacters(gameId);
      console.log('[GameContext] User characters loaded:', response.data);
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
      console.log('[GameContext] User is GM');
      return 'gm';
    }

    // Check participant role
    const participant = participants?.find(p => p.user_id === currentUserId);
    if (participant) {
      console.log('[GameContext] User is participant with role:', participant.role);
      return participant.role as UserGameRole;
    }

    console.log('[GameContext] User has no role in this game');
    return 'none';
  }, [currentUserId, game, participants]);

  // Compute permission flags
  const isGM = useMemo(() => userRole === 'gm', [userRole]);

  const isParticipant = useMemo(() => {
    return userRole !== 'none' && userRole !== 'audience';
  }, [userRole]);

  const canEditGame = useMemo(() => {
    return isGM;
  }, [isGM]);

  // Character ownership checker
  const isUserCharacter = useMemo(() => {
    const userCharacterIds = new Set(userCharacters?.map(c => c.id) || []);
    return (characterId: number) => userCharacterIds.has(characterId);
  }, [userCharacters]);

  // Refresh all game data
  const refetchGameData = async () => {
    console.log('[GameContext] Refetching all game data');
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

  console.log('[GameContext] Context state:', {
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
