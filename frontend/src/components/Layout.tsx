import { ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import NotificationBell from './NotificationBell';
import { Button } from './ui';
import { AdminModeToggle } from './AdminModeToggle';
import { AdminBanner } from './AdminBanner';

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
      ? `${baseClasses} bg-interactive-primary-hover text-white`
      : `${baseClasses} text-white/90 hover:bg-interactive-primary-hover hover:text-white`;
  };

  return (
    <div className="min-h-screen surface-sunken">
      {/* Navigation Bar */}
      {isAuthenticated && (
        <nav className="bg-interactive-primary shadow-lg">
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
                {/* Notification Bell */}
                <NotificationBell />

                {/* Admin Mode Toggle (only visible to admins) */}
                <AdminModeToggle />

                <Link to="/settings" className={navLinkClass('/settings')}>
                  Settings
                </Link>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleLogout}
                  className="text-white hover:bg-interactive-primary-hover"
                >
                  Logout
                </Button>
              </div>
            </div>
          </div>
        </nav>
      )}

      {/* Admin Mode Banner */}
      <AdminBanner />

      {/* Main Content */}
      <main className="py-6">
        {children}
      </main>

      {/* Footer */}
      <footer className="surface-base border-t border-theme-default mt-auto">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <p className="text-center text-sm text-content-secondary">
            &copy; 2025 ActionPhase. A collaborative role-playing platform.
          </p>
        </div>
      </footer>
    </div>
  );
};
