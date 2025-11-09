import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useCharacterOwnership } from './useCharacterOwnership';
import { apiClient } from '../lib/api';
import type { Character } from '../types/characters';

// Mock the API client
jest.mock('../lib/api');

const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;

describe('useCharacterOwnership', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
    jest.clearAllMocks();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it('should identify user-owned player characters', async () => {
    const mockCharacters: Character[] = [
      { id: 1, name: 'My Character', character_type: 'player_character', user_id: 100, game_id: 1, status: 'approved', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: 2, name: 'NPC', character_type: 'npc', game_id: 1, status: 'approved', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    ];

    mockApiClient.characters.getUserControllableCharacters = jest.fn().mockResolvedValue({
      data: mockCharacters,
    });

    const { result } = renderHook(() => useCharacterOwnership(1), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // User owns character 1
    expect(result.current.isUserCharacter(1)).toBe(true);
    // User does not own character 2
    expect(result.current.isUserCharacter(2)).toBe(true); // NPC is also in controllable list
    // User does not own character 3 (not in list)
    expect(result.current.isUserCharacter(3)).toBe(false);
  });

  it('should handle assigned NPCs', async () => {
    const mockCharacters: Character[] = [
      {
        id: 10,
        name: 'Assigned NPC',
        character_type: 'npc',
        assigned_user_id: 100,
        game_id: 1,
        status: 'approved',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
    ];

    mockApiClient.characters.getUserControllableCharacters = jest.fn().mockResolvedValue({
      data: mockCharacters,
    });

    const { result } = renderHook(() => useCharacterOwnership(1), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // User owns the assigned NPC
    expect(result.current.isUserCharacter(10)).toBe(true);
  });

  it('should work in anonymous mode (no user_id in response)', async () => {
    // In anonymous mode, the backend strips user_id from characters
    // But the controllable endpoint still works and returns your characters
    const mockCharacters: Character[] = [
      {
        id: 20,
        name: 'Anonymous Character',
        character_type: 'player_character',
        // Note: no user_id field (as in anonymous mode)
        game_id: 1,
        status: 'approved',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
    ];

    mockApiClient.characters.getUserControllableCharacters = jest.fn().mockResolvedValue({
      data: mockCharacters,
    });

    const { result } = renderHook(() => useCharacterOwnership(1), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // Even without user_id, the hook knows this is the user's character
    // because it came from the controllable endpoint
    expect(result.current.isUserCharacter(20)).toBe(true);
  });

  it('should return empty set when no characters are controllable', async () => {
    mockApiClient.characters.getUserControllableCharacters = jest.fn().mockResolvedValue({
      data: [],
    });

    const { result } = renderHook(() => useCharacterOwnership(1), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.userCharacterIds.size).toBe(0);
    expect(result.current.isUserCharacter(1)).toBe(false);
  });

  it('should provide userCharacterIds as a Set', async () => {
    const mockCharacters: Character[] = [
      { id: 1, name: 'Char 1', character_type: 'player_character', user_id: 100, game_id: 1, status: 'approved', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: 2, name: 'Char 2', character_type: 'player_character', user_id: 100, game_id: 1, status: 'approved', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: 3, name: 'Char 3', character_type: 'npc', assigned_user_id: 100, game_id: 1, status: 'approved', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    ];

    mockApiClient.characters.getUserControllableCharacters = jest.fn().mockResolvedValue({
      data: mockCharacters,
    });

    const { result } = renderHook(() => useCharacterOwnership(1), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.userCharacterIds).toBeInstanceOf(Set);
    expect(result.current.userCharacterIds.size).toBe(3);
    expect(result.current.userCharacterIds.has(1)).toBe(true);
    expect(result.current.userCharacterIds.has(2)).toBe(true);
    expect(result.current.userCharacterIds.has(3)).toBe(true);
  });
});
