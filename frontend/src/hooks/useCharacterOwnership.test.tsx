import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useCharacterOwnership } from './useCharacterOwnership';
import type { Character } from '../types/characters';
import { makeCharacter } from '../test-utils/factories';

// Mock useUserCharacters since it now reads from GameContext
vi.mock('./useUserCharacters');

import { useUserCharacters } from './useUserCharacters';
const mockUseUserCharacters = vi.mocked(useUserCharacters);

describe('useCharacterOwnership', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should identify user-owned player characters', () => {
    const mockCharacters: Character[] = [
      makeCharacter({ id: 1, name: 'My Character', user_id: 100 }),
      makeCharacter({ id: 2, name: 'NPC', character_type: 'npc', user_id: undefined, username: undefined }),
    ];

    mockUseUserCharacters.mockReturnValue({
      characters: mockCharacters,
      isLoading: false,
      error: null,
      refetch: async () => {},
    });

    const { result } = renderHook(() => useCharacterOwnership(1));

    expect(result.current.isLoading).toBe(false);
    // User owns character 1
    expect(result.current.isUserCharacter(1)).toBe(true);
    // NPC is also in controllable list
    expect(result.current.isUserCharacter(2)).toBe(true);
    // User does not own character 3 (not in list)
    expect(result.current.isUserCharacter(3)).toBe(false);
  });

  it('should handle assigned NPCs', () => {
    const mockCharacters: Character[] = [
      makeCharacter({
        id: 10,
        name: 'Assigned NPC',
        character_type: 'npc',
        assigned_user_id: 100,
        user_id: undefined,
        username: undefined,
      }),
    ];

    mockUseUserCharacters.mockReturnValue({
      characters: mockCharacters,
      isLoading: false,
      error: null,
      refetch: async () => {},
    });

    const { result } = renderHook(() => useCharacterOwnership(1));

    // User owns the assigned NPC
    expect(result.current.isUserCharacter(10)).toBe(true);
  });

  it('should work in anonymous mode (no user_id in response)', () => {
    // In anonymous mode, the backend strips user_id from characters
    // But the controllable endpoint still works and returns your characters
    const mockCharacters: Character[] = [
      makeCharacter({
        id: 20,
        name: 'Anonymous Character',
        // Anonymous mode: the backend strips the identity fields as a unit.
        user_id: undefined,
        username: undefined,
      }),
    ];

    mockUseUserCharacters.mockReturnValue({
      characters: mockCharacters,
      isLoading: false,
      error: null,
      refetch: async () => {},
    });

    const { result } = renderHook(() => useCharacterOwnership(1));

    // Even without user_id, the hook knows this is the user's character
    // because it came from the controllable endpoint
    expect(result.current.isUserCharacter(20)).toBe(true);
  });

  it('should return empty set when no characters are controllable', () => {
    mockUseUserCharacters.mockReturnValue({
      characters: [],
      isLoading: false,
      error: null,
      refetch: async () => {},
    });

    const { result } = renderHook(() => useCharacterOwnership(1));

    expect(result.current.userCharacterIds.size).toBe(0);
    expect(result.current.isUserCharacter(1)).toBe(false);
  });

  it('should provide userCharacterIds as a Set', () => {
    const mockCharacters: Character[] = [
      makeCharacter({ id: 1, name: 'Char 1', user_id: 100 }),
      makeCharacter({ id: 2, name: 'Char 2', user_id: 100 }),
      makeCharacter({ id: 3, name: 'Char 3', character_type: 'npc', assigned_user_id: 100, user_id: undefined, username: undefined }),
    ];

    mockUseUserCharacters.mockReturnValue({
      characters: mockCharacters,
      isLoading: false,
      error: null,
      refetch: async () => {},
    });

    const { result } = renderHook(() => useCharacterOwnership(1));

    expect(result.current.userCharacterIds).toBeInstanceOf(Set);
    expect(result.current.userCharacterIds.size).toBe(3);
    expect(result.current.userCharacterIds.has(1)).toBe(true);
    expect(result.current.userCharacterIds.has(2)).toBe(true);
    expect(result.current.userCharacterIds.has(3)).toBe(true);
  });
});
