import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../../test-utils';
import { DashboardPage } from '../DashboardPage';

// Mock react-router-dom
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock the useDashboard hook
vi.mock('../../hooks/useDashboard', () => ({
  useDashboard: vi.fn(),
}));

// Mock dashboard child components
vi.mock('../../components/DashboardGameCard', () => ({
  DashboardGameCard: ({ game }: any) => (
    <div data-testid="dashboard-game-card">{game.title}</div>
  ),
}));

vi.mock('../../components/UrgentActionsCard', () => ({
  UrgentActionsCard: ({ games }: any) => (
    <div data-testid="urgent-actions-card">
      Urgent games: {games.filter((g: any) => g.is_urgent).length}
    </div>
  ),
}));

vi.mock('../../components/RecentActivityCard', () => ({
  RecentActivityCard: ({ messages }: any) => (
    <div data-testid="recent-activity-card">
      Messages: {messages.length}
    </div>
  ),
}));

vi.mock('../../components/UpcomingDeadlinesCard', () => ({
  UpcomingDeadlinesCard: ({ deadlines }: any) => (
    <div data-testid="upcoming-deadlines-card">
      Deadlines: {deadlines.length}
    </div>
  ),
}));

import { useDashboard } from '../../hooks/useDashboard';

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state while fetching dashboard data', () => {
    vi.mocked(useDashboard).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as any);

    renderWithProviders(<DashboardPage />);

    expect(screen.getByText(/loading your dashboard/i)).toBeInTheDocument();
  });

  it('shows error state when dashboard fetch fails', () => {
    vi.mocked(useDashboard).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('Failed to load'),
    } as any);

    renderWithProviders(<DashboardPage />);

    expect(screen.getByText(/failed to load dashboard/i)).toBeInTheDocument();
    expect(screen.getByText(/please try refreshing the page/i)).toBeInTheDocument();
  });

  it('redirects to recruiting page when user has no games', async () => {
    vi.mocked(useDashboard).mockReturnValue({
      data: {
        user_id: 1,
        has_games: false,
        player_games: [],
        gm_games: [],
        mixed_role_games: [],
        recent_messages: [],
        upcoming_deadlines: [],
        unread_notifications: 0,
      },
      isLoading: false,
      error: null,
    } as any);

    renderWithProviders(<DashboardPage />);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/games/recruiting');
    });
  });

  it('displays dashboard when user has games', () => {
    vi.mocked(useDashboard).mockReturnValue({
      data: {
        user_id: 1,
        has_games: true,
        player_games: [
          {
            game_id: 1,
            title: 'Test Player Game',
            state: 'in_progress',
            user_role: 'player',
            has_pending_action: false,
            pending_applications: 0,
            unread_messages: 0,
            is_urgent: false,
            deadline_status: 'normal',
          },
        ],
        gm_games: [
          {
            game_id: 2,
            title: 'Test GM Game',
            state: 'recruitment',
            user_role: 'gm',
            has_pending_action: false,
            pending_applications: 3,
            unread_messages: 0,
            is_urgent: false,
            deadline_status: 'normal',
          },
        ],
        mixed_role_games: [],
        recent_messages: [
          {
            message_id: 1,
            game_id: 1,
            game_title: 'Test Game',
            author_name: 'Test Author',
            content: 'Test message',
            created_at: new Date().toISOString(),
            message_type: 'post',
          },
        ],
        upcoming_deadlines: [
          {
            phase_id: 1,
            game_id: 1,
            game_title: 'Test Game',
            phase_type: 'action',
            phase_title: 'Test Phase',
            phase_number: 1,
            end_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            has_pending_submission: false,
            hours_remaining: 24,
          },
        ],
        unread_notifications: 5,
      },
      isLoading: false,
      error: null,
    } as any);

    renderWithProviders(<DashboardPage />);

    expect(screen.getByText(/my dashboard/i)).toBeInTheDocument();
    expect(screen.getByText(/my games as player/i)).toBeInTheDocument();
    expect(screen.getByText(/games i'm running/i)).toBeInTheDocument();
    expect(screen.getByText('Test Player Game')).toBeInTheDocument();
    expect(screen.getByText('Test GM Game')).toBeInTheDocument();
  });

  it('shows urgent actions card when user has urgent games', () => {
    vi.mocked(useDashboard).mockReturnValue({
      data: {
        user_id: 1,
        has_games: true,
        player_games: [
          {
            game_id: 1,
            title: 'Urgent Game',
            state: 'in_progress',
            user_role: 'player',
            has_pending_action: true,
            pending_applications: 0,
            unread_messages: 0,
            is_urgent: true,
            deadline_status: 'critical',
            current_phase_deadline: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
          },
        ],
        gm_games: [],
        mixed_role_games: [],
        recent_messages: [],
        upcoming_deadlines: [],
        unread_notifications: 0,
      },
      isLoading: false,
      error: null,
    } as any);

    renderWithProviders(<DashboardPage />);

    expect(screen.getByTestId('urgent-actions-card')).toBeInTheDocument();
    expect(screen.getByText(/urgent games: 1/i)).toBeInTheDocument();
  });

  it('displays recent activity and upcoming deadlines sidebars', () => {
    vi.mocked(useDashboard).mockReturnValue({
      data: {
        user_id: 1,
        has_games: true,
        player_games: [],
        gm_games: [],
        mixed_role_games: [],
        recent_messages: [
          {
            message_id: 1,
            game_id: 1,
            game_title: 'Test Game',
            author_name: 'Test Author',
            content: 'Test message',
            created_at: new Date().toISOString(),
            message_type: 'post',
          },
          {
            message_id: 2,
            game_id: 1,
            game_title: 'Test Game',
            author_name: 'Another Author',
            content: 'Another message',
            created_at: new Date().toISOString(),
            message_type: 'comment',
          },
        ],
        upcoming_deadlines: [
          {
            phase_id: 1,
            game_id: 1,
            game_title: 'Test Game',
            phase_type: 'action',
            phase_title: 'Test Phase',
            phase_number: 1,
            end_time: new Date().toISOString(),
            has_pending_submission: true,
            hours_remaining: 12,
          },
          {
            phase_id: 2,
            game_id: 2,
            game_title: 'Another Game',
            phase_type: 'action',
            phase_title: 'Another Phase',
            phase_number: 2,
            end_time: new Date().toISOString(),
            has_pending_submission: false,
            hours_remaining: 48,
          },
        ],
        unread_notifications: 0,
      },
      isLoading: false,
      error: null,
    } as any);

    renderWithProviders(<DashboardPage />);

    expect(screen.getByTestId('recent-activity-card')).toBeInTheDocument();
    expect(screen.getByText(/messages: 2/i)).toBeInTheDocument();

    expect(screen.getByTestId('upcoming-deadlines-card')).toBeInTheDocument();
    expect(screen.getByText(/deadlines: 2/i)).toBeInTheDocument();
  });

  it('shows mixed role games section when user has games with both roles', () => {
    vi.mocked(useDashboard).mockReturnValue({
      data: {
        user_id: 1,
        has_games: true,
        player_games: [],
        gm_games: [],
        mixed_role_games: [
          {
            game_id: 1,
            title: 'Mixed Role Game',
            state: 'in_progress',
            user_role: 'both',
            has_pending_action: false,
            pending_applications: 0,
            unread_messages: 0,
            is_urgent: false,
            deadline_status: 'normal',
          },
        ],
        recent_messages: [],
        upcoming_deadlines: [],
        unread_notifications: 0,
      },
      isLoading: false,
      error: null,
    } as any);

    renderWithProviders(<DashboardPage />);

    expect(screen.getByText(/other games/i)).toBeInTheDocument();
    expect(screen.getByText('Mixed Role Game')).toBeInTheDocument();
  });

  it('returns null when data is undefined and not loading', () => {
    vi.mocked(useDashboard).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
    } as any);

    const { container } = renderWithProviders(<DashboardPage />);

    expect(container.firstChild).toBeNull();
  });
});
