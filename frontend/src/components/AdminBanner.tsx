import { useAdminMode } from '../hooks/useAdminMode';
import { Shield, X } from 'lucide-react';

/**
 * AdminBanner
 *
 * Prominent banner displayed when admin mode is active.
 * Provides visual feedback and quick toggle to exit admin mode.
 *
 * This banner appears across all pages when admin mode is enabled,
 * serving as a constant reminder that the user is operating with elevated privileges.
 */
export function AdminBanner() {
  const { adminModeEnabled, toggleAdminMode } = useAdminMode();

  // Only show banner when admin mode is enabled
  if (!adminModeEnabled) {
    return null;
  }

  return (
    <div
      className="bg-semantic-warning/20 border-b-2 border-semantic-warning"
      role="alert"
      aria-live="polite"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between py-3">
          <div className="flex items-center space-x-3">
            <Shield className="h-5 w-5 text-semantic-warning" aria-hidden="true" />
            <div>
              <span className="font-semibold text-semantic-warning">
                Admin Mode Active
              </span>
              <span className="text-sm text-semantic-warning ml-3">
                You have elevated privileges. You can view all games and moderate content.
              </span>
            </div>
          </div>

          <button
            onClick={toggleAdminMode}
            className="flex items-center space-x-2 px-3 py-1.5 rounded-md
                       bg-semantic-warning/10 hover:bg-semantic-warning-hover/20
                       text-semantic-warning text-sm font-medium
                       transition-colors focus:outline-none focus:ring-2 focus:ring-semantic-warning focus:ring-offset-2"
            aria-label="Exit admin mode"
          >
            <X className="h-4 w-4" aria-hidden="true" />
            <span>Exit Admin Mode</span>
          </button>
        </div>
      </div>
    </div>
  );
}
