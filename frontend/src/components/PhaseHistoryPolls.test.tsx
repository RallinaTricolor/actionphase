import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PhaseHistoryPolls } from './PhaseHistoryPolls';
import * as hooks from '../hooks';
import type { Poll } from '../types/polls';

// Mock the PollCard component to avoid needing to mock all its dependencies
vi.mock('./PollCard', () => ({
  PollCard: ({ poll }: { poll: Poll }) => (
    <div data-testid={`poll-${poll.id}`}>
      <h3>{poll.question}</h3>
    </div>
  ),
}));

// Mock the hooks module
vi.mock('../hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../hooks')>();
  return {
    ...actual,
    usePollsByPhase: vi.fn(),
  };
});

describe('PhaseHistoryPolls', () => {
  const defaultProps = {
    gameId: 1,
    phaseId: 10,
    isGM: false,
    isAudience: false,
  };

  const mockPolls: Poll[] = [
    {
      id: 1,
      game_id: 1,
      phase_id: 10,
      created_by_user_id: 1,
      created_by_character_id: null,
      question: 'What should we do next?',
      description: 'Choose our next action',
      deadline: '2024-12-31T23:59:59Z',
      vote_as_type: 'player',
      show_individual_votes: false,
      allow_other_option: false,
      is_expired: true,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      user_has_voted: true,
      voted_character_ids: [],
    },
    {
      id: 2,
      game_id: 1,
      phase_id: 10,
      created_by_user_id: 1,
      created_by_character_id: null,
      question: 'Which path to take?',
      description: 'Vote on our route',
      deadline: '2024-12-31T23:59:59Z',
      vote_as_type: 'character',
      show_individual_votes: true,
      allow_other_option: true,
      is_expired: true,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      user_has_voted: false,
      voted_character_ids: [],
    },
  ];

  it('renders loading state', () => {
    vi.mocked(hooks.usePollsByPhase).mockReturnValue({
      data: [],
      isLoading: true,
      error: null,
    });

    render(<PhaseHistoryPolls {...defaultProps} />);

    // Query by role since Spinner has duplicate text (visible + sr-only)
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getAllByText('Loading polls...')).toHaveLength(2); // visible + sr-only
  });

  it('renders error state', () => {
    const error = new Error('Failed to load polls');
    vi.mocked(hooks.usePollsByPhase).mockReturnValue({
      data: [],
      isLoading: false,
      error,
    });

    render(<PhaseHistoryPolls {...defaultProps} />);

    expect(screen.getByText('Error Loading Polls')).toBeInTheDocument();
    expect(screen.getByText('Failed to load polls')).toBeInTheDocument();
  });

  it('renders empty state when no polls exist', () => {
    vi.mocked(hooks.usePollsByPhase).mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    });

    render(<PhaseHistoryPolls {...defaultProps} />);

    expect(screen.getByText('No polls for this phase')).toBeInTheDocument();
    expect(screen.getByText('There were no polls created during this phase.')).toBeInTheDocument();
  });

  it('renders polls successfully', () => {
    vi.mocked(hooks.usePollsByPhase).mockReturnValue({
      data: mockPolls,
      isLoading: false,
      error: null,
    });

    render(<PhaseHistoryPolls {...defaultProps} />);

    // Should show poll count
    expect(screen.getByText(/Showing 2 polls from this phase/i)).toBeInTheDocument();

    // Should render both poll questions
    expect(screen.getByText('What should we do next?')).toBeInTheDocument();
    expect(screen.getByText('Which path to take?')).toBeInTheDocument();
  });

  it('passes correct props to usePollsByPhase hook', () => {
    const mockHook = vi.mocked(hooks.usePollsByPhase);
    mockHook.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    });

    render(<PhaseHistoryPolls gameId={5} phaseId={15} isGM={true} />);

    expect(mockHook).toHaveBeenCalledWith(5, 15);
  });

  it('handles single poll correctly', () => {
    vi.mocked(hooks.usePollsByPhase).mockReturnValue({
      data: [mockPolls[0]],
      isLoading: false,
      error: null,
    });

    render(<PhaseHistoryPolls {...defaultProps} />);

    // Should show singular "poll" instead of "polls"
    expect(screen.getByText(/Showing 1 poll from this phase/i)).toBeInTheDocument();
  });

  it('passes isGM and isAudience props to PollCard', () => {
    vi.mocked(hooks.usePollsByPhase).mockReturnValue({
      data: [mockPolls[0]],
      isLoading: false,
      error: null,
    });

    const { rerender } = render(<PhaseHistoryPolls {...defaultProps} isGM={true} />);

    // PollCard should be rendered (we can't directly test props passed to it,
    // but we can verify the component renders with different prop combinations)
    expect(screen.getByText('What should we do next?')).toBeInTheDocument();

    // Rerender with isAudience
    rerender(<PhaseHistoryPolls {...defaultProps} isAudience={true} />);
    expect(screen.getByText('What should we do next?')).toBeInTheDocument();
  });
});
