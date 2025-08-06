import { useAuth } from '../hooks/useAuth';
import { usePing } from '../hooks/useAuth';
import { GamesList } from '../components/GamesList';

export const DashboardPage = () => {
  const { logout } = useAuth();
  const { data: pingData, isLoading: isPingLoading, error: pingError } = usePing();

  const handleLogout = () => {
    logout();
    window.location.href = '/login';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
            <button
              onClick={handleLogout}
              className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
            >
              Logout
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

            {/* API Health Check Card */}
            <div className="bg-white overflow-hidden shadow rounded-lg">
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
            <div className="bg-white overflow-hidden shadow rounded-lg">
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

            {/* API Endpoints Card */}
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Available Endpoints
                      </dt>
                      <dd className="mt-2 text-sm text-gray-900">
                        <ul className="space-y-1">
                          <li>POST /api/v1/auth/login</li>
                          <li>POST /api/v1/auth/register</li>
                          <li>GET /api/v1/auth/refresh</li>
                          <li>GET /ping</li>
                        </ul>
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* Games List */}
          <div className="mt-8">
            <GamesList />
          </div>

          {/* Welcome Message */}
          <div className="mt-8 bg-white shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                Welcome to ActionPhase!
              </h3>
              <div className="mt-2 max-w-xl text-sm text-gray-500">
                <p>
                  This is a modern React frontend built with TypeScript, Tailwind CSS,
                  and React Query to work with your Go backend. All authentication
                  endpoints are integrated and ready for testing.
                </p>
              </div>
              <div className="mt-5">
                <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                  <div className="flex">
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-blue-800">
                        Features implemented:
                      </h3>
                      <div className="mt-2 text-sm text-blue-700">
                        <ul className="list-disc list-inside space-y-1">
                          <li>JWT authentication with automatic token refresh</li>
                          <li>User registration and login</li>
                          <li>Protected routes</li>
                          <li>API health monitoring</li>
                          <li>Modern UI with Tailwind CSS</li>
                          <li>TypeScript for type safety</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
