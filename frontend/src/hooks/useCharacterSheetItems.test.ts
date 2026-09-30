import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useCharacterSheetItems, useGameCharacterSheetItems } from './useCharacterSheetItems';
import type { CharacterData, CharacterSheetConfig } from '../types/characters';

const mockGame = vi.hoisted(() => ({ current: undefined as { character_sheet?: CharacterSheetConfig } | undefined }));
vi.mock('../contexts/GameContext', () => ({
  useOptionalGameContext: () => (mockGame.current ? { gameId: 1, game: mockGame.current } : null),
}));

vi.mock('../lib/api', () => ({
  apiClient: {
    characters: {
      getCharacterData: vi.fn(),
      getGameCharacterData: vi.fn(),
    },
  },
}));

import { apiClient } from '../lib/api';

function makeWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

function makeDataRow(overrides: Partial<CharacterData>): CharacterData {
  return {
    id: 1,
    character_id: 42,
    module_type: 'skills',
    field_name: 'skills',
    field_type: 'json',
    is_public: true,
    created_at: '',
    updated_at: '',
    ...overrides,
  };
}

describe('useCharacterSheetItems', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty array when characterId is null', () => {
    const { result } = renderHook(() => useCharacterSheetItems(null), {
      wrapper: makeWrapper(),
    });
    expect(result.current).toEqual([]);
    expect(apiClient.characters.getCharacterData).not.toHaveBeenCalled();
  });

  it('parses skills into SheetItem[]', async () => {
    vi.mocked(apiClient.characters.getCharacterData).mockResolvedValue({
      data: [
        makeDataRow({
          module_type: 'skills',
          field_name: 'skills',
          field_value: JSON.stringify([
            { id: 'sk-1', name: 'Stealth', rank: 'Expert', category: 'Combat' },
          ]),
        }),
      ],
    } as never);

    const { result } = renderHook(() => useCharacterSheetItems(42), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current).toHaveLength(1));

    expect(result.current[0]).toMatchObject({
      id: 'sk-1',
      name: 'Stealth',
      refKind: 'skill',
      tabKey: 'skills',
      tabLabel: 'Skills',
      metadata: 'Rank: Expert · Category: Combat',
    });
  });

  // Rows written before the level -> rank rename are never migrated: the key
  // lives inside a JSON blob and is resolved on read instead. A numeric value
  // has to survive that path, since `level` was typed `number | string`.
  it('falls back to the legacy numeric level for unmigrated skill rows', async () => {
    vi.mocked(apiClient.characters.getCharacterData).mockResolvedValue({
      data: [
        makeDataRow({
          module_type: 'skills',
          field_name: 'skills',
          field_value: JSON.stringify([
            { id: 'sk-1', name: 'Stealth', level: 3, category: 'Combat' },
          ]),
        }),
      ],
    } as never);

    const { result } = renderHook(() => useCharacterSheetItems(42), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current).toHaveLength(1));

    expect(result.current[0]).toMatchObject({
      name: 'Stealth',
      metadata: 'Rank: 3 · Category: Combat',
    });
  });

  it('parses inventory items into SheetItem[]', async () => {
    vi.mocked(apiClient.characters.getCharacterData).mockResolvedValue({
      data: [
        makeDataRow({
          module_type: 'inventory',
          field_name: 'items',
          field_value: JSON.stringify([
            { id: 'it-1', name: 'Elvish Longbow', description: 'A fine bow', quantity: 1, category: 'Weapon' },
          ]),
        }),
      ],
    } as never);

    const { result } = renderHook(() => useCharacterSheetItems(42), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current).toHaveLength(1));

    expect(result.current[0]).toMatchObject({
      id: 'it-1',
      name: 'Elvish Longbow',
      refKind: 'item',
      tabKey: 'inventory',
      tabLabel: 'Inventory',
      metadata: 'Quantity: 1 · Category: Weapon',
    });
  });

  // A roll on a CSV-imported loot table is written verbatim by the server, so
  // its numbers arrive as strings.
  it('reads an item quantity stored as a string', async () => {
    vi.mocked(apiClient.characters.getCharacterData).mockResolvedValue({
      data: [
        makeDataRow({
          module_type: 'inventory',
          field_name: 'items',
          field_value: JSON.stringify([{ id: 'it-1', name: 'Arrows', quantity: '20', category: 'Ammo' }]),
        }),
      ],
    } as never);

    const { result } = renderHook(() => useCharacterSheetItems(42), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current).toHaveLength(1));
    expect(result.current[0].metadata).toBe('Quantity: 20 · Category: Ammo');
  });

  it('filters out skills missing id or name', async () => {
    vi.mocked(apiClient.characters.getCharacterData).mockResolvedValue({
      data: [
        makeDataRow({
          field_name: 'skills',
          field_value: JSON.stringify([
            { id: 'abc-1', name: 'Good Skill', level: 2, category: 'Combat' },
            { name: 'No ID', level: 2, category: 'Combat' },
            { id: 'abc-3', level: 2, category: 'Combat' },
          ]),
        }),
      ],
    } as never);

    const { result } = renderHook(() => useCharacterSheetItems(42), {
      wrapper: makeWrapper(),
    });

    // Wait for query to settle — only 1 valid item should appear. Asserting the
    // result inside waitFor is a positive condition, so it polls until the state
    // lands; a bare sleep would let that update escape act() and warn.
    await waitFor(() => {
      expect(apiClient.characters.getCharacterData).toHaveBeenCalledWith(42);
      expect(result.current).toHaveLength(1);
    });

    expect(result.current[0].name).toBe('Good Skill');
  });
});

// Every tab in the game's layout is mentionable, read with that tab's schema.
describe('useCharacterSheetItems with a composed layout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGame.current = {
      character_sheet: {
        tabs: [
          { key: 't_abc123', label: 'Contacts', fields: [
            { key: 'f_rel001', label: 'Relationship', type: 'select', options: ['Ally', 'Rival'] },
            { key: 'f_loc001', label: 'Location', type: 'text' },
            { key: 'f_trust1', label: 'Trust', type: 'track' },
            { key: 'description', label: 'Description', type: 'markdown' },
          ] },
          { key: 'inventory', label: 'Gear' },
        ],
      },
    };
  });
  afterEach(() => {
    mockGame.current = undefined;
  });

  it("covers custom tabs, under each tab's label, and drops tabs the layout removed", async () => {
    vi.mocked(apiClient.characters.getCharacterData).mockResolvedValue({
      data: [
        makeDataRow({ module_type: 'skills', field_name: 'skills', field_value: JSON.stringify([{ id: 's1', name: 'Hidden Skill' }]) }),
        makeDataRow({
          module_type: 't_abc123',
          field_name: 't_abc123',
          field_value: JSON.stringify([
            { id: 'c1', name: 'Old Zadok', f_rel001: 'Ally', f_loc001: 'Docks', f_trust1: { value: 2, max: 5 }, description: 'Drinks.' },
          ]),
        }),
        makeDataRow({ module_type: 'inventory', field_name: 'items', field_value: JSON.stringify([{ id: 'i1', name: 'Rope' }]) }),
      ],
    } as never);

    const { result } = renderHook(() => useCharacterSheetItems(42), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current).toHaveLength(2));

    // In layout order; Skills left the layout, so its entry is not offered.
    expect(result.current).toEqual([
      {
        id: 'c1', name: 'Old Zadok', refKind: 't_abc123', tabKey: 't_abc123', tabLabel: 'Contacts',
        description: 'Drinks.', metadata: 'Ally · Location: Docks',
      },
      { id: 'i1', name: 'Rope', refKind: 'item', tabKey: 'inventory', tabLabel: 'Gear', description: undefined, metadata: undefined },
    ]);
  });
});

// The game-scoped variant backs History and Actions, which each render many
// characters' content at once. It exists to collapse a request per character
// into one per game.
describe('useGameCharacterSheetItems', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not fetch when gameId is null', () => {
    const { result } = renderHook(() => useGameCharacterSheetItems(null), {
      wrapper: makeWrapper(),
    });

    expect(result.current.size).toBe(0);
    expect(apiClient.characters.getGameCharacterData).not.toHaveBeenCalled();
  });

  it('keys parsed sheet items by character id', async () => {
    vi.mocked(apiClient.characters.getGameCharacterData).mockResolvedValue({
      data: {
        '7': [
          makeDataRow({
            character_id: 7,
            field_value: JSON.stringify([
              { id: 'sk-1', name: 'Compel', rank: '2', description: 'Bend a ghost.', category: 'Arcane' },
            ]),
          }),
        ],
        '9': [
          makeDataRow({
            character_id: 9,
            module_type: 'inventory',
            field_name: 'items',
            field_value: JSON.stringify([
              { id: 'it-1', name: 'Spirit Bottle', description: 'Holds a ghost.', quantity: 1, category: 'Arcane' },
            ]),
          }),
        ],
      },
    } as never);

    const { result } = renderHook(() => useGameCharacterSheetItems(3), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.size).toBe(2));

    expect(result.current.get(7)?.[0]).toMatchObject({ name: 'Compel', refKind: 'skill' });
    expect(result.current.get(9)?.[0]).toMatchObject({ name: 'Spirit Bottle', refKind: 'item' });
  });

  // A character whose sheet the caller may not see is simply absent from the
  // payload; callers read that as "no tooltips", not as an error.
  it('yields nothing for a character the response omits', async () => {
    vi.mocked(apiClient.characters.getGameCharacterData).mockResolvedValue({
      data: {},
    } as never);

    const { result } = renderHook(() => useGameCharacterSheetItems(3), {
      wrapper: makeWrapper(),
    });

    await waitFor(() =>
      expect(apiClient.characters.getGameCharacterData).toHaveBeenCalledWith(3)
    );

    expect(result.current.get(7)).toBeUndefined();
  });
});
