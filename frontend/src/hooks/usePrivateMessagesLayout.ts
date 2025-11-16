import { useState, useEffect } from 'react';
import { logger } from '@/services/LoggingService';

interface LayoutState {
  sidebarCollapsed: boolean;
  sidebarWidth: number;
}

const STORAGE_KEY = 'pm_layout';
const DEFAULT_WIDTH = 320;
const MIN_WIDTH = 200;
const MAX_WIDTH = 500;

export function usePrivateMessagesLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_WIDTH);

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed: LayoutState = JSON.parse(saved);
        setSidebarCollapsed(parsed.sidebarCollapsed || false);
        setSidebarWidth(parsed.sidebarWidth || DEFAULT_WIDTH);
      } catch (_e) {
        logger.error('Failed to parse saved layout', { error: e });
      }
    }
  }, []);

  // Save to localStorage whenever state changes
  useEffect(() => {
    const state: LayoutState = { sidebarCollapsed, sidebarWidth };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [sidebarCollapsed, sidebarWidth]);

  const toggleSidebar = () => setSidebarCollapsed(prev => !prev);

  const setSidebarWidthWithBounds = (width: number) => {
    // Clamp between MIN_WIDTH and MAX_WIDTH
    const bounded = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, width));
    setSidebarWidth(bounded);
  };

  const resetToDefault = () => {
    setSidebarWidth(DEFAULT_WIDTH);
  };

  return {
    sidebarCollapsed,
    sidebarWidth,
    toggleSidebar,
    setSidebarWidth: setSidebarWidthWithBounds,
    resetToDefault,
  };
}
