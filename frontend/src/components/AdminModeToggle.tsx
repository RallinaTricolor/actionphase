import { useAdminMode } from '../hooks/useAdminMode';

/**
 * AdminModeToggle
 *
 * Toggle switch for admin users to enable/disable admin mode.
 * Only visible to users with is_admin = true.
 *
 * When admin mode is enabled, admins can:
 * - View all games on the platform
 * - Delete comments and posts for moderation
 * - See admin-specific UI elements
 */
export function AdminModeToggle() {
  const { isAdmin, adminModeEnabled, toggleAdminMode } = useAdminMode();

  // Only show toggle to admin users
  if (!isAdmin) {
    return null;
  }

  return (
    <div className="flex items-center space-x-2 px-3 py-2">
      <label
        htmlFor="admin-mode-toggle"
        className="text-sm font-medium text-white/90 cursor-pointer select-none"
      >
        Admin Mode
      </label>
      <button
        id="admin-mode-toggle"
        role="switch"
        aria-checked={adminModeEnabled}
        aria-label={adminModeEnabled ? 'Disable admin mode' : 'Enable admin mode'}
        onClick={toggleAdminMode}
        className={`
          relative inline-flex h-6 w-11 items-center rounded-full transition-colors
          focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-interactive-primary
          ${adminModeEnabled ? 'bg-warning-accent' : 'bg-white/20'}
        `}
      >
        <span
          className={`
            inline-block h-4 w-4 transform rounded-full bg-white transition-transform
            ${adminModeEnabled ? 'translate-x-6' : 'translate-x-1'}
          `}
        />
      </button>

      {/* Active indicator badge */}
      {adminModeEnabled && (
        <span className="px-2 py-0.5 text-xs font-semibold bg-warning-accent text-warning-text rounded">
          ACTIVE
        </span>
      )}
    </div>
  );
}
