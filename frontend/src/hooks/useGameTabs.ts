import { useState, useEffect, useMemo, createElement } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { Tab } from '../components/TabNavigation';
import type { GameState } from '../types/games';

interface UseGameTabsOptions {
  gameState: GameState;
  isGM: boolean;
  participantCount: number;
  currentPhaseType?: string;
}

// Icon helper to avoid JSX in .ts file
const createIcon = (path: string) =>
  createElement('svg', {
    className: 'w-4 h-4',
    fill: 'none',
    stroke: 'currentColor',
    viewBox: '0 0 24 24',
  }, createElement('path', {
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    strokeWidth: 2,
    d: path,
  }));

const icons = {
  applications: createIcon('M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z'),
  participants: createIcon('M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z'),
  info: createIcon('M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'),
  characters: createIcon('M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z'),
  commonRoom: createIcon('M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z'),
  phases: createIcon('M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z'),
  actions: createIcon('M13 10V3L4 14h7v7l9-11h-7z'),
  messages: createIcon('M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z'),
  phaseHistory: createIcon('M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z'),
};

export function useGameTabs({
  gameState,
  isGM,
  participantCount,
  currentPhaseType,
}: UseGameTabsOptions) {
  const [searchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState<string>(tabParam || 'default');

  // Phase-aware tab configuration
  const tabs: Tab[] = useMemo(() => {
    const tabList: Tab[] = [];

    if (gameState === 'recruitment') {
      if (isGM) {
        tabList.push({ id: 'applications', label: 'Applications', icon: icons.applications });
      }
      tabList.push({ id: 'participants', label: 'Participants', badge: participantCount, icon: icons.participants });
      tabList.push({ id: 'info', label: 'Game Info', icon: icons.info });
    } else if (gameState === 'character_creation') {
      tabList.push({ id: 'characters', label: 'Characters', icon: icons.characters });
      tabList.push({ id: 'participants', label: 'Participants', badge: participantCount, icon: icons.participants });
      if (isGM) {
        tabList.push({ id: 'applications', label: 'Applications', icon: icons.applications });
      }
    } else if (gameState === 'in_progress') {
      // Common Room is primary when it's a common_room phase
      if (currentPhaseType === 'common_room') {
        tabList.push({ id: 'common-room', label: 'Common Room', icon: icons.commonRoom });
      }
      // Phases tab (GM only)
      if (isGM) {
        tabList.push({ id: 'phases', label: 'Phases', icon: icons.phases });
      }
      // Actions tab
      tabList.push({ id: 'actions', label: isGM ? 'Actions' : 'Submit Action', icon: icons.actions });
      // Characters
      tabList.push({ id: 'characters', label: 'Characters', icon: icons.characters });
      // Messages
      tabList.push({ id: 'messages', label: 'Messages', icon: icons.messages });
      // Phase History
      tabList.push({ id: 'phase-history', label: 'Phase History', icon: icons.phaseHistory });
    } else if (gameState === 'completed' || gameState === 'cancelled') {
      // Post-game tabs
      tabList.push({ id: 'phase-history', label: 'Phase History', icon: icons.phaseHistory });
      tabList.push({ id: 'characters', label: 'Characters', icon: icons.characters });
      tabList.push({ id: 'participants', label: 'Participants', badge: participantCount, icon: icons.participants });
      tabList.push({ id: 'info', label: 'Game Info', icon: icons.info });
    } else {
      // Setup state - minimal tabs
      tabList.push({ id: 'info', label: 'Game Info', icon: icons.info });
    }

    return tabList;
  }, [gameState, isGM, participantCount, currentPhaseType]);

  // Default tab selection logic
  const defaultTab = useMemo(() => {
    if (tabs.length === 0) return 'info';

    // Prefer Common Room when it's available
    if (tabs.some(t => t.id === 'common-room')) return 'common-room';

    // Otherwise use first tab
    return tabs[0].id;
  }, [tabs]);

  // Sync with URL params and default tab
  useEffect(() => {
    const paramTab = searchParams.get('tab');

    if (paramTab && tabs.some(t => t.id === paramTab)) {
      // Valid tab in URL - use it
      setActiveTab(paramTab);
    } else if (activeTab === 'default' || !tabs.some(t => t.id === activeTab)) {
      // No valid tab selected - use default
      setActiveTab(defaultTab);
    }
  }, [searchParams, tabs, defaultTab, activeTab]);

  return {
    tabs,
    activeTab: activeTab === 'default' ? defaultTab : activeTab,
    setActiveTab,
  };
}
