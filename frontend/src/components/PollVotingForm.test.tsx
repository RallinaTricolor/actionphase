import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
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

  describe('Form submission', () => {
    it('calls onSuccess after successful vote submission', async () => {
      const { useSubmitVote } = await import('../hooks');
      const mockMutateAsync = vi.fn().mockResolvedValue(undefined);
      vi.mocked(useSubmitVote).mockReturnValue({
        mutateAsync: mockMutateAsync,
        isPending: false,
      } as ReturnType<typeof useSubmitVote>);

      const mockOnSuccessFn = vi.fn();
      renderWithProviders(
        <PollVotingForm
          poll={mockPoll}
          onSuccess={mockOnSuccessFn}
          onCancel={mockOnCancel}
        />
      );

      // Select an option
      fireEvent.click(screen.getByLabelText('Option A'));

      // Submit the form
      fireEvent.submit(screen.getByRole('button', { name: /submit vote/i }).closest('form')!);

      await waitFor(() => {
        expect(mockOnSuccessFn).toHaveBeenCalledTimes(1);
      });
    });

    it('shows validation error when submitting without selecting an option', async () => {
      renderWithProviders(
        <PollVotingForm
          poll={mockPoll}
          onSuccess={mockOnSuccess}
          onCancel={mockOnCancel}
        />
      );

      fireEvent.submit(screen.getByRole('button', { name: /submit vote/i }).closest('form')!);

      await waitFor(() => {
        expect(screen.getByText(/please select an option/i)).toBeInTheDocument();
      });
    });
  });

});
