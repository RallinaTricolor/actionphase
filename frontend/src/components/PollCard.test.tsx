import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { PollCard } from './PollCard';
import type { Poll } from '../types/polls';

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

    it('auto-loads results for expired polls (GM)', async () => {
      renderWithProviders(<PollCard poll={expiredPoll} gameId={100} isGM={true} isAudience={false} />);

      // For expired polls, results auto-load - no button needed
      // Component shows "Loading results..." while fetching (appears twice: visible + sr-only)
      const loadingElements = screen.getAllByText(/loading results/i);
      expect(loadingElements.length).toBeGreaterThan(0);
    });

    it('auto-loads results for expired polls (audience)', async () => {
      renderWithProviders(<PollCard poll={expiredPoll} gameId={100} isGM={false} isAudience={true} />);

      // For expired polls, results auto-load - no button needed
      const loadingElements = screen.getAllByText(/loading results/i);
      expect(loadingElements.length).toBeGreaterThan(0);
    });

    it('auto-loads results for expired polls (player)', async () => {
      renderWithProviders(<PollCard poll={expiredPoll} gameId={100} isGM={false} isAudience={false} />);

      // For expired polls, results auto-load for everyone
      const loadingElements = screen.getAllByText(/loading results/i);
      expect(loadingElements.length).toBeGreaterThan(0);
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
});
