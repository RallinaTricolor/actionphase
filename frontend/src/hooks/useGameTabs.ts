import { useState, useEffect, useMemo, createElement, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { Tab } from '../components/TabNavigation';
import type { GameState } from '../types/games';

interface UseGameTabsOptions {
  gameState: GameState;
  isGM: boolean;
  participantCount: number;
  currentPhaseType?: string;
  isAudience?: boolean;
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
  people: createIcon('M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z'),
  commonRoom: createIcon('M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z'),
  phases: createIcon('M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z'),
  actions: createIcon('M13 10V3L4 14h7v7l9-11h-7z'),
  messages: createIcon('M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z'),
  phaseHistory: createIcon('M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z'),
  audience: createIcon('M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z'),
};

export function useGameTabs({
  gameState,
  isGM,
  participantCount,
  currentPhaseType,
  isAudience = false,
}: UseGameTabsOptions) {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState<string>(tabParam || 'default');
  const [userSelectedTab, setUserSelectedTab] = useState(false); // Track if user manually selected a tab
  const hasProcessedUrlParam = useRef(false); // Track if we've already processed the initial URL param

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
      // Common Room tab - only during common_room phases
      if (currentPhaseType === 'common_room') {
        tabList.push({ id: 'common-room', label: 'Common Room', icon: icons.commonRoom });
      }

      // Phases tab (GM only)
      if (isGM) {
        tabList.push({ id: 'phases', label: 'Phases', icon: icons.phases });
      }

      // Actions tab - only during action phases
      if (currentPhaseType === 'action') {
        tabList.push({ id: 'actions', label: isGM ? 'Actions' : 'Submit Action', icon: icons.actions });
      }

      // People tab (combines Characters and Participants)
      tabList.push({ id: 'people', label: 'People', badge: participantCount, icon: icons.people });

      // Messages
      tabList.push({ id: 'messages', label: 'Messages', icon: icons.messages });

      // Audience tab (GM and audience members only)
      if (isGM || isAudience) {
        tabList.push({ id: 'audience', label: 'Audience', icon: icons.audience });
      }

      // Phase History - context-aware label
      // During action phases, label as "History" for brevity
      const phaseHistoryLabel = currentPhaseType === 'action' ? 'History' : 'Phase History';
      tabList.push({ id: 'phase-history', label: phaseHistoryLabel, icon: icons.phaseHistory });
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

  // Smart default tab selection logic based on game context
  const defaultTab = useMemo(() => {
    if (tabs.length === 0) return 'info';

    // Priority 1: In-progress game - phase-aware defaults
    if (gameState === 'in_progress' && currentPhaseType) {
      if (currentPhaseType === 'common_room') {
        // Common room phase - everyone goes to common room
        if (tabs.some(t => t.id === 'common-room')) return 'common-room';
      } else if (currentPhaseType === 'action') {
        // Action phase - different default for GM vs players
        // Both GM and players benefit from seeing Actions tab first
        // GM: See pending submissions
        // Players: Submit or review their action
        if (tabs.some(t => t.id === 'actions')) return 'actions';
      }
    }

    // Priority 2: Recruitment - applications for GM, info for players
    if (gameState === 'recruitment') {
      if (isGM && tabs.some(t => t.id === 'applications')) {
        return 'applications';
      }
      // Players see game info during recruitment
      if (tabs.some(t => t.id === 'info')) return 'info';
    }

    // Priority 3: Character creation - go to characters or people
    if (gameState === 'character_creation') {
      if (tabs.some(t => t.id === 'characters')) return 'characters';
      if (tabs.some(t => t.id === 'people')) return 'people';
    }

    // Priority 4: Completed/cancelled games - phase history
    if (gameState === 'completed' || gameState === 'cancelled') {
      if (tabs.some(t => t.id === 'phase-history')) return 'phase-history';
    }

    // Fallback: First tab
    return tabs[0].id;
  }, [tabs, gameState, currentPhaseType, isGM]);

  // Process URL parameter changes (including from notifications)
  useEffect(() => {
    const paramTab = searchParams.get('tab');

    // If there's a tab parameter in the URL and it's a valid tab
    if (paramTab && tabs.some(t => t.id === paramTab)) {
      // Only switch if it's different from current tab
      if (activeTab !== paramTab) {
        setActiveTab(paramTab);
        setUserSelectedTab(true); // URL param counts as user selection
      }
      hasProcessedUrlParam.current = true;
    }
  }, [searchParams, tabs, activeTab]);

  // Apply smart default when phase data loads (if user hasn't selected a tab)
  useEffect(() => {
    // Don't override if we've already processed a URL param
    if (hasProcessedUrlParam.current) {
      return;
    }

    if (!userSelectedTab && (activeTab === 'default' || activeTab !== defaultTab)) {
      // User hasn't manually selected a tab - apply smart default
      // This allows the default to update when phase data loads
      setActiveTab(defaultTab);
    } else if (!tabs.some(t => t.id === activeTab)) {
      // Current tab is no longer valid (e.g., action phase ended) - reset to default
      setActiveTab(defaultTab);
      setUserSelectedTab(false);
    }
  }, [tabs, defaultTab, activeTab, userSelectedTab]);

  // Wrapper for setActiveTab that tracks user selection and updates URL
  const handleSetActiveTab = (tabId: string) => {
    setActiveTab(tabId);
    setUserSelectedTab(true);

    // Update URL with new tab parameter
    const newParams = new URLSearchParams(searchParams);
    newParams.set('tab', tabId);
    setSearchParams(newParams, { replace: true });
  };

  return {
    tabs,
    activeTab: activeTab === 'default' ? defaultTab : activeTab,
    setActiveTab: handleSetActiveTab,
  };
}
