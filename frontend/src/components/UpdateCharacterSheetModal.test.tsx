import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { UpdateCharacterSheetModal } from './UpdateCharacterSheetModal';
import { renderWithProviders } from '../test-utils/render';
import { server } from '../mocks/server';

const BASE_PROPS = {
  isOpen: true,
  onClose: vi.fn(),
  gameId: 1,
  actionResultId: 10,
  characterId: 42,
  characterName: 'Aldric the Bold',
};

// Well-formed ability matching the CharacterAbility interface
const ABILITY = { id: 'str', name: 'Strength', type: 'innate' as const, active: true };
const ITEM = { id: 'item-1', name: 'Healing Potion', quantity: 2 };
const ITEM_DRAFT = { id: 'item-2', name: 'Magic Sword', quantity: 1 };

const CHAR_DATA_ABILITIES = [
  {
    id: 1,
    character_id: 42,
    module_type: 'abilities',
    field_name: 'abilities',
    field_value: JSON.stringify([ABILITY]),
    field_type: 'json',
    is_public: true,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
  },
];

const CHAR_DATA_ITEMS = [
  {
    id: 2,
    character_id: 42,
    module_type: 'inventory',
    field_name: 'items',
    field_value: JSON.stringify([ITEM]),
    field_type: 'json',
    is_public: true,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
  },
];

// A draft that overrides the inventory items
const DRAFT_ITEMS = [
  {
    id: 100,
    action_result_id: 10,
    character_id: 42,
    module_type: 'inventory',
    field_name: 'items',
    field_value: JSON.stringify([ITEM_DRAFT]),
    field_type: 'json',
    operation: 'upsert',
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
  },
];

function setupHandlers({
  characterData = [] as unknown[],
  drafts = null as null | unknown[],
}: {
  characterData?: unknown[];
  drafts?: null | unknown[];
} = {}) {
  server.use(
    http.get('http://localhost:3000/api/v1/characters/:id/data', () => {
      return HttpResponse.json(characterData);
    }),
    http.get(
      'http://localhost:3000/api/v1/games/:gameId/results/:resultId/character-updates',
      () => {
        return HttpResponse.json(drafts);
      },
    ),
    http.post(
      'http://localhost:3000/api/v1/games/:gameId/results/:resultId/character-updates',
      () => {
        return HttpResponse.json({
          id: 101,
          action_result_id: 10,
          character_id: 42,
          module_type: 'abilities',
          field_name: 'abilities',
          field_value: '[]',
          field_type: 'json',
          operation: 'upsert',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      },
    ),
  );
}

async function waitForLoaded() {
  await waitFor(() => {
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
}

describe('UpdateCharacterSheetModal', () => {
  beforeEach(() => {
    server.resetHandlers();
    vi.clearAllMocks();
  });

  describe('Loading state', () => {
    it('shows spinner while data is loading', () => {
      server.use(
        http.get('http://localhost:3000/api/v1/characters/:id/data', async () => {
          await new Promise(() => {}); // never resolves
          return HttpResponse.json([]);
        }),
        http.get(
          'http://localhost:3000/api/v1/games/:gameId/results/:resultId/character-updates',
          async () => {
            await new Promise(() => {}); // never resolves
            return HttpResponse.json(null);
          },
        ),
      );

      renderWithProviders(<UpdateCharacterSheetModal {...BASE_PROPS} />);

      expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('does not render when isOpen is false', () => {
      const { container } = renderWithProviders(
        <UpdateCharacterSheetModal {...BASE_PROPS} isOpen={false} />,
      );
      expect(container.firstChild).toBeNull();
    });
  });

  describe('Initialization from characterData (no drafts)', () => {
    it('shows abilities from characterData when no drafts exist', async () => {
      setupHandlers({ characterData: CHAR_DATA_ABILITIES, drafts: null });

      renderWithProviders(<UpdateCharacterSheetModal {...BASE_PROPS} />);
      await waitForLoaded();

      expect(screen.getByText('Strength')).toBeInTheDocument();
    });

    it('shows inventory items from characterData when no drafts exist', async () => {
      setupHandlers({ characterData: CHAR_DATA_ITEMS, drafts: null });

      renderWithProviders(<UpdateCharacterSheetModal {...BASE_PROPS} />);
      await waitForLoaded();

      fireEvent.click(screen.getByRole('button', { name: /inventory/i }));
      expect(screen.getByText('Healing Potion')).toBeInTheDocument();
    });

    it('shows empty state when characterData has no abilities', async () => {
      setupHandlers({ characterData: [], drafts: null });

      renderWithProviders(<UpdateCharacterSheetModal {...BASE_PROPS} />);
      await waitForLoaded();

      expect(screen.getByText('No abilities yet.')).toBeInTheDocument();
    });

    it('handles null drafts response gracefully (no crash)', async () => {
      setupHandlers({ characterData: CHAR_DATA_ABILITIES, drafts: null });

      renderWithProviders(<UpdateCharacterSheetModal {...BASE_PROPS} />);
      await waitForLoaded();

      expect(screen.getByText('Strength')).toBeInTheDocument();
    });

    it('handles empty array drafts response', async () => {
      setupHandlers({ characterData: CHAR_DATA_ABILITIES, drafts: [] });

      renderWithProviders(<UpdateCharacterSheetModal {...BASE_PROPS} />);
      await waitForLoaded();

      expect(screen.getByText('Strength')).toBeInTheDocument();
    });
  });

  describe('Draft-first initialization', () => {
    it('uses draft values over characterData for inventory', async () => {
      // characterData has "Healing Potion"; draft has "Magic Sword"
      setupHandlers({
        characterData: CHAR_DATA_ITEMS,
        drafts: DRAFT_ITEMS,
      });

      renderWithProviders(<UpdateCharacterSheetModal {...BASE_PROPS} />);
      await waitForLoaded();

      fireEvent.click(screen.getByRole('button', { name: /inventory/i }));

      expect(screen.getByText('Magic Sword')).toBeInTheDocument();
      expect(screen.queryByText('Healing Potion')).not.toBeInTheDocument();
    });

    it('falls back to characterData for sections not covered by a draft', async () => {
      // Draft only covers inventory; abilities section has no draft
      setupHandlers({
        characterData: [...CHAR_DATA_ABILITIES, ...CHAR_DATA_ITEMS],
        drafts: DRAFT_ITEMS,
      });

      renderWithProviders(<UpdateCharacterSheetModal {...BASE_PROPS} />);
      await waitForLoaded();

      // Abilities tab (default) — no draft for abilities, so characterData is used
      expect(screen.getByText('Strength')).toBeInTheDocument();
    });
  });

  describe('Section navigation', () => {
    it('starts on the abilities section', async () => {
      setupHandlers({ characterData: [], drafts: null });

      renderWithProviders(<UpdateCharacterSheetModal {...BASE_PROPS} />);
      await waitForLoaded();

      expect(screen.getByText('No abilities yet.')).toBeInTheDocument();
    });

    it('switches to inventory section when tab is clicked', async () => {
      setupHandlers({ characterData: [], drafts: null });

      renderWithProviders(<UpdateCharacterSheetModal {...BASE_PROPS} />);
      await waitForLoaded();

      fireEvent.click(screen.getByRole('button', { name: /inventory/i }));

      expect(screen.getByText('No items yet.')).toBeInTheDocument();
    });
  });

  describe('Header content', () => {
    it('shows character name and modal title', async () => {
      setupHandlers({ characterData: [], drafts: null });

      renderWithProviders(<UpdateCharacterSheetModal {...BASE_PROPS} />);
      await waitForLoaded();

      expect(screen.getByText('Aldric the Bold')).toBeInTheDocument();
      expect(screen.getByText('Update Character Sheet')).toBeInTheDocument();
    });
  });

  describe('Done button', () => {
    it('calls onClose when Done is clicked', async () => {
      const onClose = vi.fn();
      setupHandlers({ characterData: [], drafts: null });

      renderWithProviders(
        <UpdateCharacterSheetModal {...BASE_PROPS} onClose={onClose} />,
      );
      await waitForLoaded();

      fireEvent.click(screen.getByRole('button', { name: /done/i }));

      expect(onClose).toHaveBeenCalledOnce();
    });
  });

  describe('Re-initialization on reopen', () => {
    it('resets initialization when modal is closed and reopened', async () => {
      setupHandlers({ characterData: CHAR_DATA_ABILITIES, drafts: null });

      const { rerender } = renderWithProviders(
        <UpdateCharacterSheetModal {...BASE_PROPS} />,
      );

      await waitFor(() => {
        expect(screen.getByText('Strength')).toBeInTheDocument();
      });

      // Close
      rerender(
        <UpdateCharacterSheetModal {...BASE_PROPS} isOpen={false} onClose={vi.fn()} />,
      );

      // Reopen — should re-initialize successfully
      rerender(
        <UpdateCharacterSheetModal {...BASE_PROPS} isOpen={true} onClose={vi.fn()} />,
      );

      await waitFor(() => {
        expect(screen.getByText('Strength')).toBeInTheDocument();
      });
    });
  });
});
