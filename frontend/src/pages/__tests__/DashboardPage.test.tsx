import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../test-utils';
import { makeQueryResult, makeDashboardGameCard, makeDashboardDeadline } from '../../test-utils/factories';
import { DashboardPage } from '../DashboardPage';
import type { ComponentProps } from 'react';
import type { DashboardData } from '../../types/dashboard';
import type { DashboardGameCard } from '../../components/DashboardGameCard';
import type { UrgentActionsCard } from '../../components/UrgentActionsCard';
import type { RecentActivityCard } from '../../components/RecentActivityCard';
import type { UpcomingDeadlinesCard } from '@/components/deadlines/UpcomingDeadlinesCard';
import type { ActivityTabs } from '../../components/Dashboard/ActivityTabs';

// Mock the useDashboard hook
vi.mock('../../hooks/useDashboard', () => ({
  useDashboard: vi.fn(),
}));

// Mock dashboard child components.
//
// Each stub takes the real component's prop type via ComponentProps, so a prop
// rename breaks the stub instead of being silently ignored. These were declared
// `: unknown`, which cannot be destructured at all -- the props were untyped in
// practice and every field access was unchecked.
vi.mock('../../components/DashboardGameCard', () => ({
  DashboardGameCard: ({ game }: ComponentProps<typeof DashboardGameCard>) => (
    <div data-testid="dashboard-game-card">{game.title}</div>
  ),
}));

vi.mock('../../components/UrgentActionsCard', () => ({
  UrgentActionsCard: ({ games }: ComponentProps<typeof UrgentActionsCard>) => (
    <div data-testid="urgent-actions-card">
      Urgent games: {games.filter((g) => g.is_urgent).length}
    </div>
  ),
}));

vi.mock('../../components/RecentActivityCard', () => ({
  RecentActivityCard: ({ messages }: ComponentProps<typeof RecentActivityCard>) => (
    <div data-testid="recent-activity-card">
      Messages: {messages.length}
    </div>
  ),
}));

vi.mock('@/components/deadlines/UpcomingDeadlinesCard', () => ({
  UpcomingDeadlinesCard: ({ deadlines }: ComponentProps<typeof UpcomingDeadlinesCard>) => (
    <div data-testid="upcoming-deadlines-card">
      Deadlines: {deadlines.length}
    </div>
  ),
}));

vi.mock('../../components/Dashboard/ActivityTabs', () => ({
  ActivityTabs: ({ deadlines, messages }: ComponentProps<typeof ActivityTabs>) => (
    <div data-testid="activity-tabs">
      Deadlines: {deadlines.length}, Messages: {messages.length}
    </div>
  ),
}));

vi.mock('../../hooks/useDashboardConversations', () => ({
  useDashboardConversations: vi.fn().mockReturnValue({ data: [] }),
}));

vi.mock('@/components/notifications/NotificationDigest', () => ({
  NotificationDigest: () => <div data-testid="notification-digest" />,
}));

vi.mock('../../components/PrivateMessagePreview', () => ({
  PrivateMessagePreview: () => <div data-testid="private-message-preview" />,
}));

import { useDashboard } from '../../hooks/useDashboard';

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state while fetching dashboard data', () => {
    vi.mocked(useDashboard).mockReturnValue(makeQueryResult<DashboardData>({
      data: undefined,
      isLoading: true,
      error: null,
    }));

    renderWithProviders(<DashboardPage />);

    expect(screen.getByText(/loading your dashboard/i)).toBeInTheDocument();
  });

  it('shows error state when dashboard fetch fails', () => {
    vi.mocked(useDashboard).mockReturnValue(makeQueryResult<DashboardData>({
      data: undefined,
      isLoading: false,
      error: new Error('Failed to load'),
    }));

    renderWithProviders(<DashboardPage />);

    expect(screen.getByText(/failed to load dashboard/i)).toBeInTheDocument();
    expect(screen.getByText(/please try refreshing the page/i)).toBeInTheDocument();
  });

  it('shows empty state when user has no games', () => {
    vi.mocked(useDashboard).mockReturnValue(makeQueryResult<DashboardData>({
      data: {
        user_id: 1,
        has_games: false,
        player_games: [],
        gm_games: [],
        audience_games: [], mixed_role_games: [],
        recent_messages: [],
        upcoming_deadlines: [],
        unread_notifications: 0, notifications_by_type: {},
      },
      isLoading: false,
      error: null,
    }));

    renderWithProviders(<DashboardPage />);

    expect(screen.getByText(/welcome to actionphase!/i)).toBeInTheDocument();
    expect(screen.getByText(/you're not currently in any games/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /browse games/i })).toBeInTheDocument();
  });

  it('displays dashboard when user has games', () => {
    vi.mocked(useDashboard).mockReturnValue(makeQueryResult<DashboardData>({
      data: {
        user_id: 1,
        has_games: true,
        player_games: [
          makeDashboardGameCard({
            game_id: 1,
            title: 'Test Player Game',
            state: 'in_progress',
            user_role: 'player',
            has_pending_action: false,
            pending_applications: 0,
            unread_comments: 0,
            is_urgent: false,
            deadline_status: 'normal',
          }),
        ],
        gm_games: [
          makeDashboardGameCard({
            game_id: 2,
            title: 'Test GM Game',
            state: 'recruitment',
            user_role: 'gm',
            has_pending_action: false,
            pending_applications: 3,
            unread_comments: 0,
            is_urgent: false,
            deadline_status: 'normal',
          }),
        ],
        audience_games: [], mixed_role_games: [],
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
          makeDashboardDeadline({
            phase_id: 1,
            game_id: 1,
            game_title: 'Test Game',
            phase_type: 'action',
            phase_title: 'Test Phase',
            phase_number: 1,
            end_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            has_pending_submission: false,
            hours_remaining: 24,
          }),
        ],
        unread_notifications: 5,
        notifications_by_type: {},
      },
      isLoading: false,
      error: null,
    }));

    renderWithProviders(<DashboardPage />);

    expect(screen.getByText(/my dashboard/i)).toBeInTheDocument();
    expect(screen.getByText(/my games as player/i)).toBeInTheDocument();
    expect(screen.getByText(/games i'm running/i)).toBeInTheDocument();
    expect(screen.getByText('Test Player Game')).toBeInTheDocument();
    expect(screen.getByText('Test GM Game')).toBeInTheDocument();
  });

  it('shows urgent actions card when user has urgent games', () => {
    vi.mocked(useDashboard).mockReturnValue(makeQueryResult<DashboardData>({
      data: {
        user_id: 1,
        has_games: true,
        player_games: [
          makeDashboardGameCard({
            title: 'Urgent Game',
            has_pending_action: true,
            is_urgent: true,
            deadline_status: 'critical',
            current_phase_deadline: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
          }),
        ],
        gm_games: [],
        audience_games: [], mixed_role_games: [],
        recent_messages: [],
        upcoming_deadlines: [],
        unread_notifications: 0, notifications_by_type: {},
      },
      isLoading: false,
      error: null,
    }));

    renderWithProviders(<DashboardPage />);

    expect(screen.getByTestId('urgent-actions-card')).toBeInTheDocument();
    expect(screen.getByText(/urgent games: 1/i)).toBeInTheDocument();
  });

  it('displays recent activity and upcoming deadlines sidebars', () => {
    vi.mocked(useDashboard).mockReturnValue(makeQueryResult<DashboardData>({
      data: {
        user_id: 1,
        has_games: true,
        player_games: [],
        gm_games: [],
        audience_games: [], mixed_role_games: [],
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
          makeDashboardDeadline({
            phase_id: 1,
            game_id: 1,
            game_title: 'Test Game',
            phase_type: 'action',
            phase_title: 'Test Phase',
            phase_number: 1,
            end_time: new Date().toISOString(),
            has_pending_submission: true,
            hours_remaining: 12,
          }),
          makeDashboardDeadline({
            phase_id: 2,
            game_id: 2,
            game_title: 'Another Game',
            phase_type: 'action',
            phase_title: 'Another Phase',
            phase_number: 2,
            end_time: new Date().toISOString(),
            has_pending_submission: false,
            hours_remaining: 48,
          }),
        ],
        unread_notifications: 0, notifications_by_type: {},
      },
      isLoading: false,
      error: null,
    }));

    renderWithProviders(<DashboardPage />);

    // Mobile: ActivityTabs should be present
    expect(screen.getByTestId('activity-tabs')).toBeInTheDocument();

    // Desktop: individual cards should be present
    expect(screen.getByTestId('recent-activity-card')).toBeInTheDocument();
    expect(screen.getByTestId('upcoming-deadlines-card')).toBeInTheDocument();
  });

  it('shows mixed role games section when user has games with both roles', () => {
    vi.mocked(useDashboard).mockReturnValue(makeQueryResult<DashboardData>({
      data: {
        user_id: 1,
        has_games: true,
        player_games: [],
        gm_games: [],
        audience_games: [],
        mixed_role_games: [
          makeDashboardGameCard({
            game_id: 1,
            title: 'Mixed Role Game',
            state: 'in_progress',
            user_role: 'both',
            has_pending_action: false,
            pending_applications: 0,
            unread_comments: 0,
            is_urgent: false,
            deadline_status: 'normal',
          }),
        ],
        recent_messages: [],
        upcoming_deadlines: [],
        unread_notifications: 0, notifications_by_type: {},
      },
      isLoading: false,
      error: null,
    }));

    renderWithProviders(<DashboardPage />);

    expect(screen.getByText(/other games/i)).toBeInTheDocument();
    expect(screen.getByText('Mixed Role Game')).toBeInTheDocument();
  });

  it('returns null when data is undefined and not loading', () => {
    vi.mocked(useDashboard).mockReturnValue(makeQueryResult<DashboardData>({
      data: undefined,
      isLoading: false,
      error: null,
    }));

    const { container } = renderWithProviders(<DashboardPage />);

    expect(container.firstChild).toBeNull();
  });
});
