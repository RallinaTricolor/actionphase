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
  isParticipant?: boolean;
  hasCharacters?: boolean;
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
  history: createIcon('M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z'),
  audience: createIcon('M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z'),
  handouts: createIcon('M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253'),
};

export function useGameTabs({
  gameState,
  isGM,
  participantCount,
  currentPhaseType,
  isAudience = false,
  isParticipant = false,
  hasCharacters = false,
}: UseGameTabsOptions) {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState<string>(tabParam || 'default');
  const hasSetInitialTab = useRef(false); // Track if we've set the initial tab

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

      // Actions tab - Only visible during action phases to:
      // 1. GM (can see all actions)
      // 2. Regular participants (can submit actions)
      // NOT visible to audience or non-participants
      if (currentPhaseType === 'action' && (isGM || isParticipant)) {
        tabList.push({ id: 'actions', label: isGM ? 'Actions' : 'Submit Action', icon: icons.actions });
      }

      // People tab (combines Characters and Participants)
      tabList.push({ id: 'people', label: 'People', badge: participantCount, icon: icons.people });

      // Messages - Only visible to:
      // 1. GM (always)
      // 2. Regular participants (players)
      // 3. Audience members WITH assigned NPCs
      const canSeeMessages = isGM || isParticipant || (isAudience && hasCharacters);
      if (canSeeMessages) {
        tabList.push({ id: 'messages', label: 'Messages', icon: icons.messages });
      }

      // Handouts - available to all participants
      tabList.push({ id: 'handouts', label: 'Handouts', icon: icons.handouts });

      // Audience tab (GM and audience members only)
      if (isGM || isAudience) {
        tabList.push({ id: 'audience', label: 'Audience', icon: icons.audience });
      }

      // History - context-aware label
      tabList.push({ id: 'history', label: 'History', icon: icons.history });
    } else if (gameState === 'completed' || gameState === 'cancelled') {
      // Post-game tabs - read-only archive view
      tabList.push({ id: 'history', label: 'History', icon: icons.history });
      tabList.push({ id: 'characters', label: 'Characters', icon: icons.characters });
      tabList.push({ id: 'participants', label: 'Participants', badge: participantCount, icon: icons.participants });

      // Handouts - available to view historical handouts
      tabList.push({ id: 'handouts', label: 'Handouts', icon: icons.handouts });

      // Audience tab
      // - Completed games: Always visible (public archive, anyone can view audience posts)
      // - Cancelled games: Only visible to GM/audience (game remains private)
      if (gameState === 'completed' || isGM || isAudience) {
        tabList.push({ id: 'audience', label: 'Audience', icon: icons.audience });
      }

      tabList.push({ id: 'info', label: 'Game Info', icon: icons.info });
    } else {
      // Setup state - minimal tabs
      tabList.push({ id: 'info', label: 'Game Info', icon: icons.info });
    }

    return tabList;
  }, [gameState, isGM, participantCount, currentPhaseType, isParticipant, isAudience, hasCharacters]);

  // Smart default tab selection logic based on game context
  const defaultTab = useMemo(() => {
    if (tabs.length === 0) return 'default';

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

    // Priority 4: Completed/cancelled games - history
    if (gameState === 'completed' || gameState === 'cancelled') {
      if (tabs.some(t => t.id === 'history')) return 'history';
    }

    // Fallback: First tab
    return tabs[0].id;
  }, [tabs, gameState, currentPhaseType, isGM]);

  // Handle URL parameters and apply smart defaults
  useEffect(() => {
    // Don't run if tabs haven't loaded yet (avoid false positives on invalid tabs)
    if (tabs.length === 0) {
      return;
    }

    // Don't run if game data hasn't loaded yet - wait for actual game state
    // This prevents redirecting URL params before we know what tabs should exist
    // Also skip 'setup' state as it's transient during loading
    if (!gameState || gameState === 'setup') {
      return;
    }

    // Check if there's a URL param
    const urlTab = searchParams.get('tab');

    if (urlTab) {
      // If URL tab is valid, use it
      if (tabs.some(t => t.id === urlTab)) {
        hasSetInitialTab.current = true;
        if (activeTab !== urlTab) {
          setActiveTab(urlTab);
        }
        return;
      } else {
        // Invalid URL param - redirect to default tab
        if (hasSetInitialTab.current) {
          setActiveTab(defaultTab);
          const newParams = new URLSearchParams(searchParams);
          newParams.set('tab', defaultTab);
          setSearchParams(newParams, { replace: true });
        }
        return;
      }
    }

    // No URL parameter - set the default tab in URL
    if (!hasSetInitialTab.current) {
      setActiveTab(defaultTab);
      const newParams = new URLSearchParams(searchParams);
      newParams.set('tab', defaultTab);
      setSearchParams(newParams, { replace: true });
      hasSetInitialTab.current = true;
    } else if (!tabs.some(t => t.id === activeTab)) {
      // Current tab is no longer valid (e.g., action phase ended) - reset to default
      setActiveTab(defaultTab);
      const newParams = new URLSearchParams(searchParams);
      newParams.set('tab', defaultTab);
      setSearchParams(newParams, { replace: true });
    }
  }, [tabs, defaultTab, activeTab, searchParams, setSearchParams, gameState]);

  // Wrapper for setActiveTab that updates URL with new tab
  const handleSetActiveTab = (tabId: string) => {
    setActiveTab(tabId);
    // Update URL with new tab parameter (creates history entry)
    const newParams = new URLSearchParams(searchParams);
    newParams.set('tab', tabId);
    setSearchParams(newParams, { replace: false });
  };

  return {
    tabs,
    activeTab: activeTab === 'default' ? defaultTab : activeTab,
    setActiveTab: handleSetActiveTab,
  };
}
