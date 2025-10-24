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
 * TabNavigation - Tab component with semantic theme tokens
 *
 * Now uses semantic tokens instead of hard-coded colors for automatic theme adaptation.
 */
export function TabNavigation({ tabs, activeTab, onTabChange }: TabNavigationProps) {
  return (
    <div className="border-b border-theme-default surface-base rounded-t-lg">
      <nav className="flex -mb-px overflow-x-auto" role="tablist" aria-label="Tabs">
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
