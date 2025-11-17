import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../mocks/server';
import { renderWithProviders } from '../../test-utils/render';
import type { Character, CharacterData } from '../../types/characters';

// Tell vitest to use the manual mocks
vi.mock('../AbilitiesManager');
vi.mock('../InventoryManager');

import { CharacterSheet } from '../CharacterSheet';

const mockCharacter: Character = {
  id: 1,
  game_id: 1,
  name: 'Test Hero',
  character_type: 'player_character',
  user_id: 100,
  status: 'approved',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

const mockCharacterData: CharacterData[] = [
  {
    id: 1,
    character_id: 1,
    module_type: 'bio',
    field_name: 'background',
    field_value: 'A brave warrior',
    field_type: 'text',
    is_public: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
];

describe('CharacterSheet', () => {
  beforeEach(() => {
    server.use(
      http.get('/api/v1/characters/:characterId', () => HttpResponse.json(mockCharacter)),
      http.get('/api/v1/characters/:characterId/data', () => HttpResponse.json(mockCharacterData))
    );
  });

  describe('Loading State', () => {
    it('shows loading skeleton', () => {
      renderWithProviders(<CharacterSheet characterId={1} />);
      expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
    });

    it('hides loading after data loads', async () => {
      renderWithProviders(<CharacterSheet characterId={1} />);
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /test hero/i })).toBeInTheDocument();
      });
    });
  });

  describe('Header', () => {
    it('displays character name', async () => {
      renderWithProviders(<CharacterSheet characterId={1} />);
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /test hero/i })).toBeInTheDocument();
      });
    });

    it('displays character type', async () => {
      renderWithProviders(<CharacterSheet characterId={1} />);
      await waitFor(() => {
        expect(screen.getByText(/player character/i)).toBeInTheDocument();
      });
    });

    it('displays character status', async () => {
      renderWithProviders(<CharacterSheet characterId={1} />);
      await waitFor(() => {
        expect(screen.getByText(/status: approved/i)).toBeInTheDocument();
      });
    });
  });

  describe('Tabs - Viewer Mode', () => {
    it('shows only bio tab', async () => {
      renderWithProviders(<CharacterSheet characterId={1} canEdit={false} />);
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /bio/i })).toBeInTheDocument();
      });
      expect(screen.queryByRole('button', { name: /abilities/i })).not.toBeInTheDocument();
    });
  });

  describe('Tabs - Editor Mode', () => {
    it('shows all tabs', async () => {
      renderWithProviders(<CharacterSheet characterId={1} canEdit={true} />);
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /bio/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /abilities/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /inventory/i })).toBeInTheDocument();
      });
    });
  });

  describe('Bio Display', () => {
    it('displays field value', async () => {
      renderWithProviders(<CharacterSheet characterId={1} canEdit={false} />);
      await waitFor(() => {
        expect(screen.getByText('A brave warrior')).toBeInTheDocument();
      });
    });

    it('shows public badge', async () => {
      renderWithProviders(<CharacterSheet characterId={1} canEdit={true} />);
      await waitFor(() => {
        const publicBadges = screen.getAllByText(/public/i);
        expect(publicBadges.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Field Editing', () => {
    it('hides edit button for viewers', async () => {
      renderWithProviders(<CharacterSheet characterId={1} canEdit={false} />);
      await waitFor(() => {
        expect(screen.getByText('A brave warrior')).toBeInTheDocument();
      });
      expect(screen.queryByRole('button', { name: /^edit$/i })).not.toBeInTheDocument();
    });

    it('shows edit button for editors', async () => {
      renderWithProviders(<CharacterSheet characterId={1} canEdit={true} />);
      await waitFor(() => {
        const editButtons = screen.getAllByRole('button', { name: /^edit$/i });
        expect(editButtons.length).toBeGreaterThan(0);
      });
    });

    it('enters edit mode', async () => {
      const user = userEvent.setup();
      renderWithProviders(<CharacterSheet characterId={1} canEdit={true} />);

      await waitFor(() => {
        expect(screen.getByText('A brave warrior')).toBeInTheDocument();
      });

      await user.click(screen.getAllByRole('button', { name: /^edit$/i })[0]);
      expect(screen.getByRole('textbox')).toHaveValue('A brave warrior');
    });

    it('saves field data', async () => {
      const user = userEvent.setup();
      let savedData: unknown;

      server.use(
        http.post('/api/v1/characters/:characterId/data', async ({ request }) => {
          savedData = await request.json();
          return HttpResponse.json({ success: true });
        })
      );

      renderWithProviders(<CharacterSheet characterId={1} canEdit={true} />);

      await waitFor(() => {
        expect(screen.getByText('A brave warrior')).toBeInTheDocument();
      });

      await user.click(screen.getAllByRole('button', { name: /^edit$/i })[0]);

      const textarea = screen.getByRole('textbox');
      await user.clear(textarea);
      await user.type(textarea, 'New value');

      await user.click(screen.getByRole('button', { name: /save/i }));

      await waitFor(() => {
        expect(savedData).toBeDefined();
        expect(savedData.field_value).toBe('New value');
      });
    });
  });
});
