import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '../../mocks/server';
import { renderWithProviders } from '../../test-utils/render';
import { PrivateMessages } from '../PrivateMessages';
import type { Character } from '../../types/characters';

// Mock the auth hook
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

import { useAuth } from '../../contexts/AuthContext';

describe('PrivateMessages', () => {
  const mockCharacters: Character[] = [
    {
      id: 1,
      game_id: 1,
      name: 'Hero Character',
      character_type: 'player_character',
      user_id: 100,
      status: 'approved',
      created_at: '2024-01-01T00:00:00Z',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock the useAuth hook
    vi.mocked(useAuth).mockReturnValue({
      currentUser: {
        id: 100,
        username: 'testuser',
        email: 'test@example.com',
        avatar_url: null,
        created_at: '2024-01-01T00:00:00Z',
      },
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      isCheckingAuth: false,
      authError: null,
    });

    // Mock the conversations API
    server.use(
      http.get('/api/v1/games/:gameId/messages/conversations', () => {
        return HttpResponse.json({
          conversations: [],
        });
      })
    );
  });

  describe('Phase Restrictions', () => {
    it('shows phase restriction alert when not in common_room', async () => {
      renderWithProviders(
        <PrivateMessages
          gameId={1}
          characters={mockCharacters}
          isAnonymous={false}
          currentPhaseType="action"
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/you can read message history/i)).toBeInTheDocument();
      });

      const newButton = screen.getByRole('button', { name: /\+ new/i });
      expect(newButton).toBeDisabled();
    });

    it('does not show phase restriction alert during common_room', async () => {
      renderWithProviders(
        <PrivateMessages
          gameId={1}
          characters={mockCharacters}
          isAnonymous={false}
          currentPhaseType="common_room"
        />
      );

      await waitFor(() => {
        expect(screen.queryByText(/you can read message history/i)).not.toBeInTheDocument();
      });

      const newButton = screen.getByRole('button', { name: /\+ new/i });
      expect(newButton).not.toBeDisabled();
    });

    it('disables new conversation button during results phase', async () => {
      renderWithProviders(
        <PrivateMessages
          gameId={1}
          characters={mockCharacters}
          isAnonymous={false}
          currentPhaseType="results"
        />
      );

      await waitFor(() => {
        const newButton = screen.getByRole('button', { name: /\+ new/i });
        expect(newButton).toBeDisabled();
      });
    });

    it('shows tooltip on disabled new conversation button', async () => {
      renderWithProviders(
        <PrivateMessages
          gameId={1}
          characters={mockCharacters}
          isAnonymous={false}
          currentPhaseType="action"
        />
      );

      await waitFor(() => {
        const newButton = screen.getByRole('button', { name: /\+ new/i });
        expect(newButton).toHaveAttribute('title', 'New conversations can only be started during Common Room phases');
      });
    });

    it('shows correct tooltip on enabled new conversation button', async () => {
      renderWithProviders(
        <PrivateMessages
          gameId={1}
          characters={mockCharacters}
          isAnonymous={false}
          currentPhaseType="common_room"
        />
      );

      await waitFor(() => {
        const newButton = screen.getByRole('button', { name: /\+ new/i });
        expect(newButton).toHaveAttribute('title', 'Start a new private conversation');
      });
    });

    it('disables messaging when phase type is undefined', async () => {
      renderWithProviders(
        <PrivateMessages
          gameId={1}
          characters={mockCharacters}
          isAnonymous={false}
          currentPhaseType={undefined}
        />
      );

      await waitFor(() => {
        const newButton = screen.getByRole('button', { name: /\+ new/i });
        expect(newButton).toBeDisabled();
        expect(screen.getByText(/you can read message history/i)).toBeInTheDocument();
      });
    });
  });

  describe('Basic Rendering', () => {
    it('renders private messages component', async () => {
      renderWithProviders(
        <PrivateMessages
          gameId={1}
          characters={mockCharacters}
          isAnonymous={false}
          currentPhaseType="common_room"
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/private messages/i)).toBeInTheDocument();
      });
    });

    it('renders new conversation button', async () => {
      renderWithProviders(
        <PrivateMessages
          gameId={1}
          characters={mockCharacters}
          isAnonymous={false}
          currentPhaseType="common_room"
        />
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /\+ new/i })).toBeInTheDocument();
      });
    });
  });
});
