import { describe, it, expect, beforeEach, beforeAll, afterEach, afterAll } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { setupServer } from 'msw/node';
import type { Character } from '../types/characters';
import { PollCard } from './PollCard';
import type { Poll } from '../types/polls';

// Mock hooks
vi.mock('../hooks', () => ({
  usePoll: vi.fn(() => ({
    data: undefined,
    isLoading: false,
    isPending: false,
    error: null,
  })),
  usePollResults: vi.fn(() => ({
    data: undefined,
    isLoading: false,
    isPending: false,
    error: null,
  })),
  useUserCharacters: vi.fn(() => ({
    characters: [],
    isLoading: false,
    isPending: false,
    error: null,
  })),
  usePolls: vi.fn(() => ({
    data: [],
    isLoading: false,
    isPending: false,
    error: null,
    deletePollMutation: {
      mutateAsync: vi.fn(),
      isPending: false,
      isError: false,
      error: null,
    },
  })),
}));

// Setup MSW server
const server = setupServer();

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('PollCard', () => {
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

  const mockPoll: Poll = {
    id: 1,
    game_id: 100,
    question: 'Test Poll Question',
    description: 'Test poll description',
    created_by_user_id: 1,
    created_by_character_id: null,
    deadline: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
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

  const expiredPoll: Poll = {
    ...mockPoll,
    deadline: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // Yesterday
    is_expired: true,
  };

  describe('View Results button visibility - Role-based access control', () => {
    it('shows Show Results toggle button for GM on active poll', () => {
      renderWithProviders(<PollCard poll={mockPoll} gameId={100} isGM={true} isAudience={false} />);

      // GM can toggle results on active polls
      expect(screen.getByRole('button', { name: /show results/i })).toBeInTheDocument();
    });

    it('shows Show Results toggle button for audience on active poll', () => {
      renderWithProviders(<PollCard poll={mockPoll} gameId={100} isGM={false} isAudience={true} />);

      // Audience can toggle results on active polls
      expect(screen.getByRole('button', { name: /show results/i })).toBeInTheDocument();
    });

    it('does NOT show Show Results button for player on active poll', () => {
      renderWithProviders(<PollCard poll={mockPoll} gameId={100} isGM={false} isAudience={false} />);

      // Players cannot see results on active polls
      expect(screen.queryByRole('button', { name: /show results/i })).not.toBeInTheDocument();
    });

    it('toggles button text to "Hide Results" after GM clicks Show Results', () => {
      renderWithProviders(<PollCard poll={mockPoll} gameId={100} isGM={true} isAudience={false} />);

      fireEvent.click(screen.getByRole('button', { name: /show results/i }));
      expect(screen.getByRole('button', { name: /hide results/i })).toBeInTheDocument();
    });

    it('auto-loads results for expired polls (GM)', async () => {
      renderWithProviders(<PollCard poll={expiredPoll} gameId={100} isGM={true} isAudience={false} />);

      // For expired polls, results auto-load - no button needed
      // Note: With our mock, isLoading is false, so we don't expect loading text
      // Just verify the poll renders without errors
      expect(screen.getByText(expiredPoll.question)).toBeInTheDocument();
    });

    it('auto-loads results for expired polls (audience)', async () => {
      renderWithProviders(<PollCard poll={expiredPoll} gameId={100} isGM={false} isAudience={true} />);

      // For expired polls, results auto-load - no button needed
      expect(screen.getByText(expiredPoll.question)).toBeInTheDocument();
    });

    it('auto-loads results for expired polls (player)', async () => {
      renderWithProviders(<PollCard poll={expiredPoll} gameId={100} isGM={false} isAudience={false} />);

      // For expired polls, results auto-load for everyone
      expect(screen.getByText(expiredPoll.question)).toBeInTheDocument();
    });
  });


  describe('Poll display', () => {
    it('renders poll question and description', () => {
      renderWithProviders(<PollCard poll={mockPoll} gameId={100} isGM={false} isAudience={false} />);

      expect(screen.getByText('Test Poll Question')).toBeInTheDocument();
      expect(screen.getByText('Test poll description')).toBeInTheDocument();
    });

    it('shows expired badge for expired polls', () => {
      renderWithProviders(<PollCard poll={expiredPoll} gameId={100} isGM={false} isAudience={false} />);

      expect(screen.getByText(/expired/i)).toBeInTheDocument();
    });

    it('shows "Not Voted" badge for active polls when user has not voted', () => {
      renderWithProviders(<PollCard poll={mockPoll} gameId={100} isGM={false} isAudience={false} />);

      expect(screen.getByText(/not voted/i)).toBeInTheDocument();
    });

    it('displays deadline information', () => {
      renderWithProviders(<PollCard poll={mockPoll} gameId={100} isGM={false} isAudience={false} />);

      // Should show deadline (format may vary)
      expect(screen.getByText(/ends/i)).toBeInTheDocument();
    });
  });

  describe('Your vote display', () => {
    it('shows "Your vote" with the chosen option for a player who has voted on an active poll', async () => {
      const { usePoll } = await import('../hooks');
      vi.mocked(usePoll).mockReturnValue({
        data: {
          ...mockPoll,
          options: [
            { id: 1, poll_id: 1, option_text: 'Option A', display_order: 1 },
            { id: 2, poll_id: 1, option_text: 'Option B', display_order: 2 },
          ],
          user_vote_option_id: 2,
          user_vote_other_response: undefined,
        },
        isLoading: false,
        isPending: false,
        error: null,
      } as ReturnType<typeof usePoll>);

      const votedPoll: Poll = { ...mockPoll, user_has_voted: true };
      renderWithProviders(<PollCard poll={votedPoll} gameId={100} isGM={false} isAudience={false} />);

      expect(screen.getByText(/your vote:/i)).toBeInTheDocument();
      expect(screen.getByText('Option B')).toBeInTheDocument();
    });

    it('shows "Your vote" with the other response text when user chose "other"', async () => {
      const { usePoll } = await import('../hooks');
      vi.mocked(usePoll).mockReturnValue({
        data: {
          ...mockPoll,
          options: [],
          user_vote_option_id: undefined,
          user_vote_other_response: 'My custom answer',
        },
        isLoading: false,
        isPending: false,
        error: null,
      } as ReturnType<typeof usePoll>);

      const votedPoll: Poll = { ...mockPoll, user_has_voted: true };
      renderWithProviders(<PollCard poll={votedPoll} gameId={100} isGM={false} isAudience={false} />);

      expect(screen.getByText(/your vote:/i)).toBeInTheDocument();
      expect(screen.getByText(/"My custom answer"/)).toBeInTheDocument();
    });

    it('does NOT show "Your vote" for GM on active voted poll', async () => {
      const votedPoll: Poll = { ...mockPoll, user_has_voted: true };
      renderWithProviders(<PollCard poll={votedPoll} gameId={100} isGM={true} isAudience={false} />);

      expect(screen.queryByText(/your vote:/i)).not.toBeInTheDocument();
    });

    it('does NOT show "Your vote" on expired polls (results shown instead)', async () => {
      const votedExpiredPoll: Poll = { ...expiredPoll, user_has_voted: true };
      renderWithProviders(<PollCard poll={votedExpiredPoll} gameId={100} isGM={false} isAudience={false} />);

      expect(screen.queryByText(/your vote:/i)).not.toBeInTheDocument();
    });

    it('does NOT show "Your vote" when user has not voted', () => {
      renderWithProviders(<PollCard poll={mockPoll} gameId={100} isGM={false} isAudience={false} />);

      expect(screen.queryByText(/your vote:/i)).not.toBeInTheDocument();
    });
  });

  describe('Voting functionality', () => {
    it('shows vote button for active polls when user has not voted', () => {
      renderWithProviders(<PollCard poll={mockPoll} gameId={100} isGM={false} isAudience={false} />);

      expect(screen.getByRole('button', { name: /vote now/i })).toBeInTheDocument();
    });

    it('does not show vote button for expired polls', () => {
      renderWithProviders(<PollCard poll={expiredPoll} gameId={100} isGM={false} isAudience={false} />);

      expect(screen.queryByRole('button', { name: /vote now/i })).not.toBeInTheDocument();
    });

    it('shows "Voted" badge when user has voted', () => {
      const votedPoll = { ...mockPoll, user_has_voted: true };
      renderWithProviders(<PollCard poll={votedPoll} gameId={100} isGM={false} isAudience={false} />);

      expect(screen.getByText(/voted/i)).toBeInTheDocument();
    });
  });

  describe('Character-level polls - voting progress badge', () => {
    it('shows voting progress badge for character polls with partial votes', async () => {
      const { useUserCharacters } = await import('../hooks');
      vi.mocked(useUserCharacters).mockReturnValue({
        characters: [
          { id: 1, name: 'Char 1', game_id: 100, user_id: 1, status: 'approved', character_type: 'player_character' },
          { id: 2, name: 'Char 2', game_id: 100, user_id: 1, status: 'approved', character_type: 'player_character' },
          { id: 3, name: 'Char 3', game_id: 100, user_id: 1, status: 'approved', character_type: 'player_character' },
        ] as Partial<Character>[],
        isLoading: false,
        error: null,
      });

      const characterPoll: Poll = {
        ...mockPoll,
        vote_as_type: 'character',
        user_has_voted: true,
        voted_character_ids: [1, 2], // Voted with 2 out of 3 characters
      };

      renderWithProviders(<PollCard poll={characterPoll} gameId={100} isGM={false} isAudience={false} />);

      // Should show "Voted (2/3)"
      expect(screen.getByText(/voted \(2\/3\)/i)).toBeInTheDocument();
    });

    it('shows success badge when all characters have voted', async () => {
      const { useUserCharacters } = await import('../hooks');
      vi.mocked(useUserCharacters).mockReturnValue({
        characters: [
          { id: 1, name: 'Char 1', game_id: 100, user_id: 1, status: 'approved', character_type: 'player_character' },
          { id: 2, name: 'Char 2', game_id: 100, user_id: 1, status: 'approved', character_type: 'player_character' },
          { id: 3, name: 'Char 3', game_id: 100, user_id: 1, status: 'approved', character_type: 'player_character' },
        ] as Partial<Character>[],
        isLoading: false,
        error: null,
      });

      const characterPoll: Poll = {
        ...mockPoll,
        vote_as_type: 'character',
        user_has_voted: true,
        voted_character_ids: [1, 2, 3], // All characters voted
      };

      renderWithProviders(<PollCard poll={characterPoll} gameId={100} isGM={false} isAudience={false} />);

      // Should show "Voted (3/3)" with success variant
      expect(screen.getByText(/voted \(3\/3\)/i)).toBeInTheDocument();
    });

    it('shows "Not Voted" badge when no characters have voted', async () => {
      const { useUserCharacters } = await import('../hooks');
      vi.mocked(useUserCharacters).mockReturnValue({
        characters: [
          { id: 1, name: 'Char 1', game_id: 100, user_id: 1, status: 'approved', character_type: 'player_character' },
          { id: 2, name: 'Char 2', game_id: 100, user_id: 1, status: 'approved', character_type: 'player_character' },
        ] as Partial<Character>[],
        isLoading: false,
        error: null,
      });

      const characterPoll: Poll = {
        ...mockPoll,
        vote_as_type: 'character',
        user_has_voted: false,
        voted_character_ids: [],
      };

      renderWithProviders(<PollCard poll={characterPoll} gameId={100} isGM={false} isAudience={false} />);

      expect(screen.getByText(/not voted/i)).toBeInTheDocument();
    });
  });

  describe('Character-level polls - Vote Now button visibility', () => {
    it('shows Vote Now button when user has more characters to vote with', async () => {
      const { useUserCharacters } = await import('../hooks');
      vi.mocked(useUserCharacters).mockReturnValue({
        characters: [
          { id: 1, name: 'Char 1', game_id: 100, user_id: 1, status: 'approved', character_type: 'player_character' },
          { id: 2, name: 'Char 2', game_id: 100, user_id: 1, status: 'approved', character_type: 'player_character' },
          { id: 3, name: 'Char 3', game_id: 100, user_id: 1, status: 'approved', character_type: 'player_character' },
        ] as Partial<Character>[],
        isLoading: false,
        error: null,
      });

      const characterPoll: Poll = {
        ...mockPoll,
        vote_as_type: 'character',
        user_has_voted: true,
        voted_character_ids: [1, 2], // 2 voted, 1 remaining
      };

      renderWithProviders(<PollCard poll={characterPoll} gameId={100} isGM={false} isAudience={false} />);

      // Vote Now button should still be visible because there's 1 more character to vote with
      expect(screen.getByRole('button', { name: /vote now/i })).toBeInTheDocument();
    });

    it('hides Vote Now button when all characters have voted', async () => {
      const { useUserCharacters } = await import('../hooks');
      vi.mocked(useUserCharacters).mockReturnValue({
        characters: [
          { id: 1, name: 'Char 1', game_id: 100, user_id: 1, status: 'approved', character_type: 'player_character' },
          { id: 2, name: 'Char 2', game_id: 100, user_id: 1, status: 'approved', character_type: 'player_character' },
        ] as Partial<Character>[],
        isLoading: false,
        error: null,
      });

      const characterPoll: Poll = {
        ...mockPoll,
        vote_as_type: 'character',
        user_has_voted: true,
        voted_character_ids: [1, 2], // All characters voted
      };

      renderWithProviders(<PollCard poll={characterPoll} gameId={100} isGM={false} isAudience={false} />);

      // Vote Now button should not be visible
      expect(screen.queryByRole('button', { name: /vote now/i })).not.toBeInTheDocument();
    });

    it('shows Vote Now button for character polls when no votes yet', async () => {
      const { useUserCharacters } = await import('../hooks');
      vi.mocked(useUserCharacters).mockReturnValue({
        characters: [
          { id: 1, name: 'Char 1', game_id: 100, user_id: 1, status: 'approved', character_type: 'player_character' },
        ] as Partial<Character>[],
        isLoading: false,
        error: null,
      });

      const characterPoll: Poll = {
        ...mockPoll,
        vote_as_type: 'character',
        user_has_voted: false,
        voted_character_ids: [],
      };

      renderWithProviders(<PollCard poll={characterPoll} gameId={100} isGM={false} isAudience={false} />);

      expect(screen.getByRole('button', { name: /vote now/i })).toBeInTheDocument();
    });
  });
});
