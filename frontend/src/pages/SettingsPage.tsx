import { useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { ChangePasswordForm } from '../components/ChangePasswordForm';
import { ActiveSessions } from '../components/ActiveSessions';
import { ChangeUsernameForm } from '../components/ChangeUsernameForm';
import { ChangeEmailForm } from '../components/ChangeEmailForm';
import { SettingsSidebar } from '../components/SettingsSidebar';

export function SettingsPage() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [activeSection, setActiveSection] = useState('appearance');

  const sections = [
    {
      id: 'appearance',
      label: 'Appearance',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
        </svg>
      ),
    },
    {
      id: 'security',
      label: 'Account Security',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      ),
    },
    {
      id: 'account',
      label: 'Account Information',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-content-primary mb-8">Settings</h1>

      <div className="flex flex-col md:flex-row gap-6">
        {/* Sidebar Navigation */}
        <SettingsSidebar
          sections={sections}
          activeSection={activeSection}
          onSectionChange={setActiveSection}
        />

        {/* Content Area */}
        <div className="flex-1">{/* Appearance Section */}
        {activeSection === 'appearance' && (

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
                      value="highContrast"
                      checked={theme === 'highContrast'}
                      onChange={(e) => setTheme(e.target.value as 'highContrast')}
                      className="h-4 w-4 text-interactive-primary focus:ring-2 focus:ring-interactive-primary"
                    />
                    <div className="ml-3">
                      <div className="text-sm font-medium text-content-primary">
                        High Contrast
                      </div>
                      <div className="text-sm text-content-tertiary">
                        Maximum contrast light theme for accessibility
                      </div>
                    </div>
                  </label>

                  <label className="flex items-center p-3 border border-theme-default rounded-lg cursor-pointer hover:bg-surface-raised">
                    <input
                      type="radio"
                      name="theme"
                      value="highContrastDark"
                      checked={theme === 'highContrastDark'}
                      onChange={(e) => setTheme(e.target.value as 'highContrastDark')}
                      className="h-4 w-4 text-interactive-primary focus:ring-2 focus:ring-interactive-primary"
                    />
                    <div className="ml-3">
                      <div className="text-sm font-medium text-content-primary">
                        High Contrast Dark
                      </div>
                      <div className="text-sm text-content-tertiary">
                        Maximum contrast dark theme for accessibility
                      </div>
                    </div>
                  </label>

                  <label className="flex items-center p-3 border border-theme-default rounded-lg cursor-pointer hover:bg-surface-raised">
                    <input
                      type="radio"
                      name="theme"
                      value="colorblind"
                      checked={theme === 'colorblind'}
                      onChange={(e) => setTheme(e.target.value as 'colorblind')}
                      className="h-4 w-4 text-interactive-primary focus:ring-2 focus:ring-interactive-primary"
                    />
                    <div className="ml-3">
                      <div className="text-sm font-medium text-content-primary">
                        Colorblind-Friendly
                      </div>
                      <div className="text-sm text-content-tertiary">
                        Optimized for color vision deficiency
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
        )}

        {/* Account Security Section */}
        {activeSection === 'security' && (
          <div className="bg-surface-base rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-content-primary mb-4">
              Account Security
            </h2>
            <div className="space-y-6">
              <ChangePasswordForm />
              <ActiveSessions />
            </div>
          </div>
        )}

        {/* Account Information Section */}
        {activeSection === 'account' && (
          <div className="bg-surface-base rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-content-primary mb-4">
              Account Information
            </h2>
            <div className="space-y-6">
              <ChangeUsernameForm />
              <ChangeEmailForm />
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
