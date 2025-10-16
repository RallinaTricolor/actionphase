import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { GamesList } from '../components/GamesList';
import { BackendStatus } from '../components/BackendStatus';

export const HomePage = () => {
  const { isAuthenticated, logout } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">ActionPhase</h1>
              <p className="text-gray-600 mt-1">Play-by-Post RPG Platform</p>
            </div>

            <div className="flex items-center space-x-4">
              {isAuthenticated ? (
                <>
                  <Link
                    to="/dashboard"
                    className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  >
                    Dashboard
                  </Link>
                  <button
                    onClick={logout}
                    className="text-gray-600 hover:text-gray-900 px-4 py-2 rounded-md border border-gray-300 hover:bg-gray-50"
                  >
                    Logout
                  </button>
                </>
              ) : (
                <Link
                  to="/login"
                  className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  Login
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Backend Status */}
        <div className="mb-8">
          <BackendStatus />
        </div>

        {/* Games Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Available Games</h2>
              <p className="text-gray-600 mt-1">Join a game or browse ongoing campaigns</p>
            </div>
            {isAuthenticated && (
              <button className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2">
                Create Game
              </button>
            )}
          </div>

          <GamesList />
        </div>

        {/* Info Section */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-8">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">
              What is ActionPhase?
            </h3>
            <div className="prose text-gray-600 max-w-none">
              <p className="mb-4">
                ActionPhase is a specialized platform for play-by-post RPG games that alternate between
                two distinct phases:
              </p>

              <div className="grid md:grid-cols-2 gap-6 mt-6">
                <div className="bg-blue-50 p-6 rounded-lg">
                  <h4 className="font-semibold text-blue-900 mb-2">Common Room Phase</h4>
                  <p className="text-blue-800 text-sm">
                    Asynchronous discussion where players interact in-character, plan strategies,
                    and develop relationships. No time pressure - take your time to craft the
                    perfect response.
                  </p>
                </div>

                <div className="bg-green-50 p-6 rounded-lg">
                  <h4 className="font-semibold text-green-900 mb-2">Action Phase</h4>
                  <p className="text-green-800 text-sm">
                    Players submit their moves privately to the Game Master, who processes
                    all actions and reveals the results. Strategic, decisive, and exciting!
                  </p>
                </div>
              </div>

              {!isAuthenticated && (
                <div className="mt-8 p-6 bg-gray-50 rounded-lg text-center">
                  <p className="text-gray-700 mb-4">
                    Ready to join the adventure?
                  </p>
                  <Link
                    to="/login"
                    className="inline-block bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  >
                    Sign Up or Login
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
