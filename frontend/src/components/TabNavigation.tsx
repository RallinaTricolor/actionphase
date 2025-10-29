import type { ReactNode } from 'react';

export interface Tab {
  id: string;
  label: string;
  badge?: number | string;
  icon?: ReactNode;
}

interface TabNavigationProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
}

/**
 * TabNavigation - Responsive tab component with dropdown on mobile
 *
 * Desktop: Horizontal tab bar with icons and labels
 * Mobile: Dropdown select menu for better space utilization
 */
export function TabNavigation({ tabs, activeTab, onTabChange }: TabNavigationProps) {
  const activeTabData = tabs.find((tab) => tab.id === activeTab);

  return (
    <div className="border-b border-theme-default surface-base rounded-t-lg">
      {/* Mobile: Dropdown Select */}
      <div className="md:hidden">
        <label htmlFor="tab-select" className="sr-only">
          Select a tab
        </label>
        <select
          id="tab-select"
          value={activeTab}
          onChange={(e) => onTabChange(e.target.value)}
          className="block w-full py-3 px-4 text-base font-medium bg-bg-primary text-content-primary border-0 focus:outline-none focus:ring-2 focus:ring-interactive-primary rounded-t-lg"
        >
          {tabs.map((tab) => (
            <option key={tab.id} value={tab.id}>
              {tab.label}
              {tab.badge !== undefined ? ` (${tab.badge})` : ''}
            </option>
          ))}
        </select>
      </div>

      {/* Desktop: Horizontal Tab Bar */}
      <nav className="hidden md:flex -mb-px overflow-x-auto" role="tablist" aria-label="Tabs">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              role="tab"
              onClick={() => onTabChange(tab.id)}
              className={`
                whitespace-nowrap py-4 px-6 border-b-2 font-medium text-sm flex items-center gap-2
                transition-colors duration-200
                ${isActive
                  ? 'border-interactive-primary text-interactive-primary'
                  : 'border-transparent text-content-secondary hover:text-content-primary hover:border-theme-default'
                }
              `}
              aria-selected={isActive}
              aria-current={isActive ? 'page' : undefined}
              data-testid={`tab-${tab.id}`}
            >
              {tab.icon && <span className="flex-shrink-0">{tab.icon}</span>}
              <span>{tab.label}</span>
              {tab.badge !== undefined && (
                <span
                  className={`
                    ml-2 py-0.5 px-2 rounded-full text-xs font-medium
                    ${isActive
                      ? 'bg-semantic-info-subtle text-content-primary'
                      : 'surface-raised text-content-secondary'
                    }
                  `}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
