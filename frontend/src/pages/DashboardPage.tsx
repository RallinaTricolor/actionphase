import { Link } from 'react-router-dom';
import { useDashboard } from '../hooks/useDashboard';
import { DashboardGameCard } from '../components/DashboardGameCard';
import { UrgentActionsCard } from '../components/UrgentActionsCard';
import { RecentActivityCard } from '../components/RecentActivityCard';
import { UpcomingDeadlinesCard } from '../components/UpcomingDeadlinesCard';
import { ActivityTabs } from '../components/Dashboard/ActivityTabs';

/**
 * DashboardPage - Main user dashboard showing games, actions, and activity
 */
export function DashboardPage() {
  const { data: dashboard, isLoading, error } = useDashboard();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-interactive-primary"></div>
          <p className="mt-4 text-content-secondary">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-semantic-danger text-lg">Failed to load dashboard</p>
          <p className="text-content-secondary mt-2">Please try refreshing the page</p>
        </div>
      </div>
    );
  }

  if (!dashboard) {
    return null;
  }

  return (
    <div className="min-h-screen bg-surface-sunken py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-content-primary">My Dashboard</h1>
          <p className="mt-2 text-content-secondary">
            Welcome back! Here's what's happening in your games.
          </p>
        </div>

        {/* Urgent Actions Section */}
        {dashboard.player_games.some((game) => game.is_urgent) && (
          <div className="mb-8">
            <UrgentActionsCard games={dashboard.player_games} />
          </div>
        )}

        {/* Empty State for Users Without Games */}
        {!dashboard.has_games ? (
          <div className="bg-surface-base shadow rounded-lg overflow-hidden">
            <div className="px-8 py-12 text-center">
              <h2 className="text-2xl font-bold text-content-primary mb-4">
                Welcome to ActionPhase!
              </h2>
              <p className="text-lg text-content-secondary mb-8 max-w-2xl mx-auto">
                You're not currently in any games. Browse available games to join or create your own campaign.
              </p>
              <Link
                to="/games"
                className="inline-block bg-interactive-primary text-white px-6 py-3 rounded-md font-semibold hover:bg-interactive-primary-hover focus:outline-none focus:ring-2 focus:ring-interactive-primary focus:ring-offset-2 transition-colors"
              >
                Browse Games
              </Link>
            </div>
          </div>
        ) : (
          /* Main Content Grid */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Mobile: Activity/Deadlines Tabs (shown at top before games) */}
            <div className="lg:hidden">
              <ActivityTabs
                deadlines={dashboard.upcoming_deadlines}
                messages={dashboard.recent_messages}
              />
            </div>

            {/* Left Column - Games */}
            <div className="lg:col-span-2 space-y-8">
              {/* Player Games */}
              {dashboard.player_games.length > 0 && (
                <section>
                  <h2 className="text-2xl font-bold text-content-primary mb-4">
                    My Games as Player
                  </h2>
                  <div className="space-y-6">
                    {dashboard.player_games.map((game) => (
                      <DashboardGameCard key={game.game_id} game={game} />
                    ))}
                  </div>
                </section>
              )}

              {/* GM Games */}
              {dashboard.gm_games.length > 0 && (
                <section>
                  <h2 className="text-2xl font-bold text-content-primary mb-4">
                    Games I'm Running
                  </h2>
                  <div className="space-y-6">
                    {dashboard.gm_games.map((game) => (
                      <DashboardGameCard key={game.game_id} game={game} />
                    ))}
                  </div>
                </section>
              )}

              {/* Mixed Role Games */}
              {dashboard.mixed_role_games.length > 0 && (
                <section>
                  <h2 className="text-2xl font-bold text-content-primary mb-4">
                    Other Games
                  </h2>
                  <div className="space-y-6">
                    {dashboard.mixed_role_games.map((game) => (
                      <DashboardGameCard key={game.game_id} game={game} />
                    ))}
                  </div>
                </section>
              )}
            </div>

            {/* Desktop: Right Column - Activity & Deadlines */}
            <div className="hidden lg:block space-y-8">
              {/* Upcoming Deadlines */}
              {dashboard.upcoming_deadlines.length > 0 && (
                <UpcomingDeadlinesCard deadlines={dashboard.upcoming_deadlines} />
              )}

              {/* Recent Activity */}
              {dashboard.recent_messages.length > 0 && (
                <RecentActivityCard messages={dashboard.recent_messages} />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
