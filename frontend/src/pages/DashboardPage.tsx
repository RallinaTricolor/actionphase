import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDashboard } from '../hooks/useDashboard';
import { DashboardGameCard } from '../components/DashboardGameCard';
import { UrgentActionsCard } from '../components/UrgentActionsCard';
import { RecentActivityCard } from '../components/RecentActivityCard';
import { UpcomingDeadlinesCard } from '../components/UpcomingDeadlinesCard';

/**
 * DashboardPage - Main user dashboard showing games, actions, and activity
 */
export function DashboardPage() {
  const navigate = useNavigate();
  const { data: dashboard, isLoading, error } = useDashboard();

  // Redirect to recruiting games if user has no games
  useEffect(() => {
    if (dashboard && !dashboard.has_games) {
      navigate('/games/recruiting');
    }
  }, [dashboard, navigate]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          <p className="mt-4 text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-red-600 text-lg">Failed to load dashboard</p>
          <p className="text-gray-600 mt-2">Please try refreshing the page</p>
        </div>
      </div>
    );
  }

  if (!dashboard) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">My Dashboard</h1>
          <p className="mt-2 text-gray-600">
            Welcome back! Here's what's happening in your games.
          </p>
        </div>

        {/* Urgent Actions Section */}
        {dashboard.player_games.some((game) => game.is_urgent) && (
          <div className="mb-8">
            <UrgentActionsCard games={dashboard.player_games} />
          </div>
        )}

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Games */}
          <div className="lg:col-span-2 space-y-8">
            {/* Player Games */}
            {dashboard.player_games.length > 0 && (
              <section>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                  My Games as Player
                </h2>
                <div className="space-y-4">
                  {dashboard.player_games.map((game) => (
                    <DashboardGameCard key={game.game_id} game={game} />
                  ))}
                </div>
              </section>
            )}

            {/* GM Games */}
            {dashboard.gm_games.length > 0 && (
              <section>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                  Games I'm Running
                </h2>
                <div className="space-y-4">
                  {dashboard.gm_games.map((game) => (
                    <DashboardGameCard key={game.game_id} game={game} />
                  ))}
                </div>
              </section>
            )}

            {/* Mixed Role Games */}
            {dashboard.mixed_role_games.length > 0 && (
              <section>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                  Other Games
                </h2>
                <div className="space-y-4">
                  {dashboard.mixed_role_games.map((game) => (
                    <DashboardGameCard key={game.game_id} game={game} />
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* Right Column - Activity & Deadlines */}
          <div className="space-y-8">
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
      </div>
    </div>
  );
}
