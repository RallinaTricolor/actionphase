import { useState, useEffect } from 'react';
import { logger } from '@/services/LoggingService';

const STORAGE_KEY = 'postCollapseState';

/**
 * Manages post collapse state with localStorage persistence.
 * Each post's collapse state is stored independently and persists across sessions.
 *
 * @param postId - The post ID to track collapse state for
 * @param defaultCollapsed - Default state if no saved preference (default: false = expanded)
 * @returns [isCollapsed, setIsCollapsed] - Tuple matching useState API
 */
export function usePostCollapseState(
  postId: number,
  defaultCollapsed: boolean = false
): [boolean, (collapsed: boolean) => void] {
  // Initialize from localStorage
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Return stored value if exists, otherwise default
        return parsed[postId] !== undefined ? parsed[postId] : defaultCollapsed;
      }
    } catch (error) {
      logger.error('Failed to read post collapse state from localStorage:', error);
    }
    return defaultCollapsed;
  });

  // Persist to localStorage whenever state changes
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const current = stored ? JSON.parse(stored) : {};
      current[postId] = isCollapsed;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
    } catch (error) {
      logger.error('Failed to save post collapse state to localStorage:', error);
    }
  }, [postId, isCollapsed]);

  return [isCollapsed, setIsCollapsed];
}
