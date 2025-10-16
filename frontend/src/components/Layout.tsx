import { ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface LayoutProps {
  children: ReactNode;
}

export const Layout = ({ children }: LayoutProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  const navLinkClass = (path: string) => {
    const baseClasses = "px-3 py-2 rounded-md text-sm font-medium transition-colors";
    return isActive(path)
      ? `${baseClasses} bg-indigo-700 text-white`
      : `${baseClasses} text-indigo-100 hover:bg-indigo-600 hover:text-white`;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation Bar */}
      {isAuthenticated && (
        <nav className="bg-indigo-600 shadow-lg">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex items-center">
                {/* Logo/Brand */}
                <Link to="/dashboard" className="flex items-center">
                  <span className="text-2xl font-bold text-white">ActionPhase</span>
                </Link>

                {/* Navigation Links */}
                <div className="ml-10 flex space-x-4">
                  <Link to="/dashboard" className={navLinkClass('/dashboard')}>
                    Dashboard
                  </Link>
                  <Link to="/games" className={navLinkClass('/games')}>
                    Games
                  </Link>
                </div>
              </div>

              {/* User Menu */}
              <div className="flex items-center space-x-4">
                <button
                  onClick={handleLogout}
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-700 hover:bg-indigo-800 rounded-md"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        </nav>
      )}

      {/* Main Content */}
      <main className="py-6">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-auto">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <p className="text-center text-sm text-gray-500">
            &copy; 2025 ActionPhase. A collaborative role-playing platform.
          </p>
        </div>
      </footer>
    </div>
  );
};
