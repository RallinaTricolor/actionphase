import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import { useGamePermissions } from './useGamePermissions';
import { apiClient } from '../lib/api';
import type { GameWithDetails } from '../types/games';
import type { GameParticipant } from '../types/games';

vi.mock('../lib/api', () => ({
  apiClient: {
    games: {
      getGameWithDetails: vi.fn(),
      getGameParticipants: vi.fn(),
    },
  },
}));

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    currentUser: { id: 1, username: 'testuser', email: 'test@example.com' },
  }),
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
};

const MOCK_GAME: GameWithDetails = {
  id: 10,
  title: 'Test Game',
  description: 'A game',
  gm_user_id: 1, // current user is GM
  state: 'in_progress',
  max_players: 5,
  is_public: true,
  is_anonymous: false,
  game_config: {},
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const makeParticipant = (userId: number, role: string): GameParticipant => ({
  id: userId * 10,
  game_id: 10,
  user_id: userId,
  role,
  joined_at: new Date().toISOString(),
  username: `user${userId}`,
});

describe('useGamePermissions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(apiClient.games.getGameParticipants).mockResolvedValue({
      data: [],
    } as never);
  });

  // -----------------------------------------------------------------
  // Role derivation — if these flags are wrong, GMs see player UI and
  // players can see GM controls. Silent and harmful.
  // -----------------------------------------------------------------

  it('identifies the GM correctly when gm_user_id matches current user', async () => {
    vi.mocked(apiClient.games.getGameWithDetails).mockResolvedValue({
      data: { ...MOCK_GAME, gm_user_id: 1 },
    } as never);

    const { result } = renderHook(() => useGamePermissions(10), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.userRole).toBe('gm');
    expect(result.current.isGM).toBe(true);
    expect(result.current.isPlayer).toBe(false);
    expect(result.current.isAudience).toBe(false);
    expect(result.current.canEditGame).toBe(true);
    expect(result.current.canManagePhases).toBe(true);
    expect(result.current.canViewAllActions).toBe(true);
  });

  it('identifies a player when current user is a participant with player role', async () => {
    vi.mocked(apiClient.games.getGameWithDetails).mockResolvedValue({
      data: { ...MOCK_GAME, gm_user_id: 99 }, // someone else is GM
    } as never);
    vi.mocked(apiClient.games.getGameParticipants).mockResolvedValue({
      data: [makeParticipant(1, 'player')], // current user (id=1) is a player
    } as never);

    const { result } = renderHook(() => useGamePermissions(10), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.userRole).toBe('player');
    expect(result.current.isPlayer).toBe(true);
    expect(result.current.isGM).toBe(false);
    expect(result.current.isParticipant).toBe(true);
    expect(result.current.canEditGame).toBe(false);
    expect(result.current.canManagePhases).toBe(false);
    expect(result.current.canViewAllActions).toBe(false);
  });

  it('identifies a co-GM — can manage phases but not edit game settings', async () => {
    vi.mocked(apiClient.games.getGameWithDetails).mockResolvedValue({
      data: { ...MOCK_GAME, gm_user_id: 99 },
    } as never);
    vi.mocked(apiClient.games.getGameParticipants).mockResolvedValue({
      data: [makeParticipant(1, 'co_gm')],
    } as never);

    const { result } = renderHook(() => useGamePermissions(10), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.userRole).toBe('co_gm');
    expect(result.current.isCoGM).toBe(true);
    expect(result.current.isGM).toBe(false);
    expect(result.current.canEditGame).toBe(false);      // co-GM cannot edit game settings
    expect(result.current.canManagePhases).toBe(true);   // but can manage phases
    expect(result.current.canViewAllActions).toBe(true);
  });

  it('identifies an audience member', async () => {
    vi.mocked(apiClient.games.getGameWithDetails).mockResolvedValue({
      data: { ...MOCK_GAME, gm_user_id: 99 },
    } as never);
    vi.mocked(apiClient.games.getGameParticipants).mockResolvedValue({
      data: [makeParticipant(1, 'audience')],
    } as never);

    const { result } = renderHook(() => useGamePermissions(10), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.userRole).toBe('audience');
    expect(result.current.isAudience).toBe(true);
    expect(result.current.isParticipant).toBe(false); // audience is NOT a participant
    expect(result.current.canManagePhases).toBe(false);
  });

  it('returns role=none for a non-member who is not GM', async () => {
    vi.mocked(apiClient.games.getGameWithDetails).mockResolvedValue({
      data: { ...MOCK_GAME, gm_user_id: 99 },
    } as never);
    vi.mocked(apiClient.games.getGameParticipants).mockResolvedValue({
      data: [], // current user is not in participants
    } as never);

    const { result } = renderHook(() => useGamePermissions(10), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.userRole).toBe('none');
    expect(result.current.isGM).toBe(false);
    expect(result.current.isPlayer).toBe(false);
    expect(result.current.isParticipant).toBe(false);
    expect(result.current.canEditGame).toBe(false);
  });
});
