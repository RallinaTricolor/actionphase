import { useTheme } from '../contexts/ThemeContext';

export function SettingsPage() {
  const { theme, setTheme, resolvedTheme } = useTheme();

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-content-primary mb-8">Settings</h1>

      <div className="bg-surface-base rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-content-primary mb-4">
          Appearance
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-content-secondary mb-2">
              Theme
            </label>
            <div className="space-y-2">
              <label className="flex items-center p-3 border border-theme-default rounded-lg cursor-pointer hover:bg-surface-raised">
                <input
                  type="radio"
                  name="theme"
                  value="light"
                  checked={theme === 'light'}
                  onChange={(e) => setTheme(e.target.value as 'light')}
                  className="h-4 w-4 text-interactive-primary focus:ring-2 focus:ring-interactive-primary"
                />
                <div className="ml-3">
                  <div className="text-sm font-medium text-content-primary">
                    Light
                  </div>
                  <div className="text-sm text-content-tertiary">
                    Always use light theme
                  </div>
                </div>
              </label>

              <label className="flex items-center p-3 border border-theme-default rounded-lg cursor-pointer hover:bg-surface-raised">
                <input
                  type="radio"
                  name="theme"
                  value="dark"
                  checked={theme === 'dark'}
                  onChange={(e) => setTheme(e.target.value as 'dark')}
                  className="h-4 w-4 text-interactive-primary focus:ring-2 focus:ring-interactive-primary"
                />
                <div className="ml-3">
                  <div className="text-sm font-medium text-content-primary">
                    Dark
                  </div>
                  <div className="text-sm text-content-tertiary">
                    Always use dark theme
                  </div>
                </div>
              </label>

              <label className="flex items-center p-3 border border-theme-default rounded-lg cursor-pointer hover:bg-surface-raised">
                <input
                  type="radio"
                  name="theme"
                  value="system"
                  checked={theme === 'system'}
                  onChange={(e) => setTheme(e.target.value as 'system')}
                  className="h-4 w-4 text-interactive-primary focus:ring-2 focus:ring-interactive-primary"
                />
                <div className="ml-3">
                  <div className="text-sm font-medium text-content-primary">
                    System
                  </div>
                  <div className="text-sm text-content-tertiary">
                    Use system preference (currently: {resolvedTheme})
                  </div>
                </div>
              </label>
            </div>
          </div>

          <div className="pt-4 border-t border-theme-default">
            <p className="text-sm text-content-secondary">
              Your theme preference is saved and will be applied across all your devices when you
              log in.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
