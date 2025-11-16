import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Character } from '../types/characters';
import { PollVotingForm } from './PollVotingForm';
import type { PollWithOptions } from '../types/polls';

// Mock the useSubmitVote and useUserCharacters hooks
vi.mock('../hooks', () => ({
  useSubmitVote: vi.fn(() => ({
    mutateAsync: vi.fn(),
    isPending: false,
  })),
  useUserCharacters: vi.fn(() => ({
    characters: [],
    isLoading: false,
    error: null,
  })),
}));

describe('PollVotingForm', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
  });

  const renderWithProviders = (component: React.ReactElement) => {
    return render(
      <QueryClientProvider client={queryClient}>
        {component}
      </QueryClientProvider>
    );
  };

  const mockPoll: PollWithOptions = {
    id: 1,
    game_id: 100,
    question: 'Test Poll Question',
    description: 'Test poll description',
    created_by_user_id: 1,
    created_by_character_id: null,
    deadline: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    vote_as_type: 'player',
    show_individual_votes: false,
    allow_other_option: false,
    is_expired: false,
    user_has_voted: false,
    options: [
      { id: 1, poll_id: 1, option_text: 'Option A', display_order: 1 },
      { id: 2, poll_id: 1, option_text: 'Option B', display_order: 2 },
    ],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const mockOnSuccess = vi.fn();
  const mockOnCancel = vi.fn();

  describe('Character filtering in character-level polls', () => {
    it('filters out already-voted characters from dropdown', async () => {
      const { useUserCharacters } = await import('../hooks');
      vi.mocked(useUserCharacters).mockReturnValue({
        characters: [
          { id: 1, name: 'Character 1', game_id: 100, user_id: 1, status: 'approved', character_type: 'player_character' } as Partial<Character>,
          { id: 2, name: 'Character 2', game_id: 100, user_id: 1, status: 'approved', character_type: 'player_character' } as Partial<Character>,
          { id: 3, name: 'Character 3', game_id: 100, user_id: 1, status: 'approved', character_type: 'player_character' } as Partial<Character>,
        ],
        isLoading: false,
        error: null,
      });

      const characterPoll: PollWithOptions = {
        ...mockPoll,
        vote_as_type: 'character',
        voted_character_ids: [1], // Character 1 has already voted
      };

      renderWithProviders(
        <PollVotingForm
          poll={characterPoll}
          onSuccess={mockOnSuccess}
          onCancel={mockOnCancel}
        />
      );

      // Should show dropdown for character selection
      expect(screen.getByText('Vote as Character')).toBeInTheDocument();

      // Character 1 should NOT be in dropdown (already voted)
      const select = screen.getByRole('combobox');
      const options = Array.from(select.querySelectorAll('option')).map(
        (opt) => opt.textContent
      );

      expect(options).toContain('Character 2');
      expect(options).toContain('Character 3');
      expect(options).not.toContain('Character 1');
    });

    it('auto-selects character when only one is available', async () => {
      const { useUserCharacters } = await import('../hooks');
      vi.mocked(useUserCharacters).mockReturnValue({
        characters: [
          { id: 1, name: 'Character 1', game_id: 100, user_id: 1, status: 'approved', character_type: 'player_character' } as Partial<Character>,
          { id: 2, name: 'Character 2', game_id: 100, user_id: 1, status: 'approved', character_type: 'player_character' } as Partial<Character>,
        ],
        isLoading: false,
        error: null,
      });

      const characterPoll: PollWithOptions = {
        ...mockPoll,
        vote_as_type: 'character',
        voted_character_ids: [1], // Character 1 already voted, only Character 2 left
      };

      renderWithProviders(
        <PollVotingForm
          poll={characterPoll}
          onSuccess={mockOnSuccess}
          onCancel={mockOnCancel}
        />
      );

      // Should auto-display the single remaining character
      await waitFor(() => {
        expect(screen.getByText(/voting as:/i)).toBeInTheDocument();
        expect(screen.getByText('Character 2')).toBeInTheDocument();
      });
    });

    it('shows warning when all characters have already voted', async () => {
      const { useUserCharacters } = await import('../hooks');
      vi.mocked(useUserCharacters).mockReturnValue({
        characters: [
          { id: 1, name: 'Character 1', game_id: 100, user_id: 1, status: 'approved', character_type: 'player_character' } as Partial<Character>,
          { id: 2, name: 'Character 2', game_id: 100, user_id: 1, status: 'approved', character_type: 'player_character' } as Partial<Character>,
        ],
        isLoading: false,
        error: null,
      });

      const characterPoll: PollWithOptions = {
        ...mockPoll,
        vote_as_type: 'character',
        voted_character_ids: [1, 2], // All characters voted
      };

      renderWithProviders(
        <PollVotingForm
          poll={characterPoll}
          onSuccess={mockOnSuccess}
          onCancel={mockOnCancel}
        />
      );

      // Should show alert about no characters available
      expect(screen.getByText(/no characters available/i)).toBeInTheDocument();
      expect(screen.getByText(/you've already voted with all your characters/i)).toBeInTheDocument();
    });

    it('shows dropdown when multiple characters are available after filtering', async () => {
      const { useUserCharacters } = await import('../hooks');
      vi.mocked(useUserCharacters).mockReturnValue({
        characters: [
          { id: 1, name: 'Character 1', game_id: 100, user_id: 1, status: 'approved', character_type: 'player_character' } as Partial<Character>,
          { id: 2, name: 'Character 2', game_id: 100, user_id: 1, status: 'approved', character_type: 'player_character' } as Partial<Character>,
          { id: 3, name: 'Character 3', game_id: 100, user_id: 1, status: 'approved', character_type: 'player_character' } as Partial<Character>,
        ],
        isLoading: false,
        error: null,
      });

      const characterPoll: PollWithOptions = {
        ...mockPoll,
        vote_as_type: 'character',
        voted_character_ids: [1], // Character 1 voted, 2 remaining
      };

      renderWithProviders(
        <PollVotingForm
          poll={characterPoll}
          onSuccess={mockOnSuccess}
          onCancel={mockOnCancel}
        />
      );

      // Should show dropdown with "Select a character..." placeholder
      expect(screen.getByRole('combobox')).toBeInTheDocument();
      expect(screen.getByText('Select a character...')).toBeInTheDocument();

      // Should have 3 options: placeholder + 2 remaining characters
      const select = screen.getByRole('combobox');
      const options = select.querySelectorAll('option');
      expect(options).toHaveLength(3); // placeholder + Character 2 + Character 3
    });
  });

  describe('Player-level polls - no character filtering', () => {
    it('does not show character selection for player polls', async () => {
      const { useUserCharacters } = await import('../hooks');
      vi.mocked(useUserCharacters).mockReturnValue({
        characters: [
          { id: 1, name: 'Character 1', game_id: 100, user_id: 1, status: 'approved', character_type: 'player_character' } as Partial<Character>,
        ],
        isLoading: false,
        error: null,
      });

      renderWithProviders(
        <PollVotingForm
          poll={mockPoll}
          onSuccess={mockOnSuccess}
          onCancel={mockOnCancel}
        />
      );

      // Should NOT show character selection for player-level polls
      expect(screen.queryByText('Vote as Character')).not.toBeInTheDocument();
      expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    });
  });
});
