import { useAuth } from '../hooks/useAuth';
import { usePing } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { GamesList } from '../components/GamesList';
import type { GameListItem } from '../types/games';

export const DashboardPage = () => {
  const navigate = useNavigate();
  const { data: pingData, isLoading: isPingLoading, error: pingError } = usePing();

  const handleGameClick = (game: GameListItem) => {
    navigate(`/games/${game.id}`);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-2 text-sm text-gray-600">
          Welcome to ActionPhase - your collaborative role-playing platform
        </p>
      </div>

      {/* Main Content */}
      <div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* API Health Check Card */}
          <div className="bg-white overflow-hidden shadow-md rounded-xl border border-gray-100">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className={`h-3 w-3 rounded-full ${
                      isPingLoading ? 'bg-yellow-500' :
                      pingError ? 'bg-red-500' : 'bg-green-500'
                    }`}></div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        API Status
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {isPingLoading ? 'Checking...' :
                         pingError ? 'Offline' : 'Online'}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-5 py-3">
                <div className="text-sm">
                  <span className="font-medium text-gray-500">Response:</span>
                  <span className="ml-2 text-gray-900">
                    {isPingLoading ? 'Loading...' :
                     pingError ? 'Error connecting' :
                     pingData?.data || 'Success'}
                  </span>
                </div>
              </div>
            </div>

          {/* Authentication Status Card */}
          <div className="bg-white overflow-hidden shadow-md rounded-xl border border-gray-100">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="h-3 w-3 bg-green-500 rounded-full"></div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Authentication
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        Authenticated
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-5 py-3">
                <div className="text-sm">
                  <span className="font-medium text-gray-500">Token:</span>
                  <span className="ml-2 text-gray-900">
                    {localStorage.getItem('auth_token') ? 'Present' : 'None'}
                  </span>
                </div>
              </div>
            </div>

          {/* Quick Stats Card */}
          <div className="bg-white overflow-hidden shadow-md rounded-xl border border-gray-100">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        System Status
                      </dt>
                      <dd className="mt-2 text-lg font-semibold text-gray-900">
                        All Systems Operational
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

        </div>

        {/* Games Section */}
        <div className="mt-8">
          <div className="mb-4">
            <h2 className="text-2xl font-bold text-gray-900">My Games</h2>
            <p className="mt-1 text-sm text-gray-600">
              Browse and manage your active role-playing games
            </p>
          </div>
          <GamesList onGameClick={handleGameClick} />
        </div>
      </div>
    </div>
  );
};
