import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { logger } from '@/services/LoggingService';

export type ReadingModeTheme = 'default' | 'sepia' | 'dark';
export type ReadingModeFontSize = 'normal' | 'large' | 'xlarge';

interface ReadingModeState {
  isActive: boolean;
  content: React.ReactNode | null; // The content to display in reading mode
  theme: ReadingModeTheme;
  fontSize: ReadingModeFontSize;
  threadModal: {
    isOpen: boolean;
    content: React.ReactNode | null;
  };
}

interface ReadingModeContextType extends ReadingModeState {
  enterReadingMode: (content: React.ReactNode) => void;
  setTheme: (theme: ReadingModeTheme) => void;
  setFontSize: (size: ReadingModeFontSize) => void;
  exitReadingMode: () => void;
  openThreadModal: (content: React.ReactNode) => void;
  closeThreadModal: () => void;
}

const ReadingModeContext = createContext<ReadingModeContextType | undefined>(undefined);

const STORAGE_KEY = 'actionphase-reading-mode';

/**
 * ReadingModeProvider
 *
 * Provides reading mode state and controls for focused, distraction-free reading.
 * Preferences are persisted in localStorage.
 *
 * Features:
 * - Toggle reading mode on/off
 * - Theme variants (default, sepia, dark)
 * - Font size options (normal, large, xlarge)
 * - Keyboard shortcut support (Alt+R)
 * - localStorage persistence
 */
export function ReadingModeProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ReadingModeState>(() => {
    // Load theme and fontSize from localStorage on mount
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          isActive: false,
          content: null,
          theme: parsed.theme || 'default',
          fontSize: parsed.fontSize || 'normal',
          threadModal: {
            isOpen: false,
            content: null,
          },
        };
      }
    } catch (error) {
      logger.error('Failed to load reading mode preferences', { error });
    }

    return {
      isActive: false,
      content: null,
      theme: 'default' as ReadingModeTheme,
      fontSize: 'normal' as ReadingModeFontSize,
      threadModal: {
        isOpen: false,
        content: null,
      },
    };
  });

  // Persist only theme and fontSize to localStorage (not content/isActive)
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        theme: state.theme,
        fontSize: state.fontSize,
      }));
    } catch (error) {
      logger.error('Failed to save reading mode preferences', { error });
    }
  }, [state.theme, state.fontSize]);

  const enterReadingMode = useCallback((content: React.ReactNode) => {
    setState(prev => ({ ...prev, isActive: true, content }));
  }, []);

  const setTheme = useCallback((theme: ReadingModeTheme) => {
    setState(prev => ({ ...prev, theme }));
  }, []);

  const setFontSize = useCallback((fontSize: ReadingModeFontSize) => {
    setState(prev => ({ ...prev, fontSize }));
  }, []);

  const exitReadingMode = useCallback(() => {
    setState(prev => ({
      ...prev,
      isActive: false,
      content: null,
      threadModal: { isOpen: false, content: null },
    }));
  }, []);

  const openThreadModal = useCallback((content: React.ReactNode) => {
    setState(prev => ({
      ...prev,
      threadModal: { isOpen: true, content },
    }));
  }, []);

  const closeThreadModal = useCallback(() => {
    setState(prev => ({
      ...prev,
      threadModal: { isOpen: false, content: null },
    }));
  }, []);

  // Keyboard shortcut: Escape to exit reading mode or close thread modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (state.threadModal.isOpen) {
          e.preventDefault();
          closeThreadModal();
        } else if (state.isActive) {
          e.preventDefault();
          exitReadingMode();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [exitReadingMode, closeThreadModal, state.isActive, state.threadModal.isOpen]);

  const value: ReadingModeContextType = {
    ...state,
    enterReadingMode,
    setTheme,
    setFontSize,
    exitReadingMode,
    openThreadModal,
    closeThreadModal,
  };

  return (
    <ReadingModeContext.Provider value={value}>
      {children}
    </ReadingModeContext.Provider>
  );
}

/**
 * useReadingMode hook
 *
 * Access reading mode state and controls.
 *
 * @example
 * const { isActive, toggleReadingMode } = useReadingMode();
 */
export function useReadingMode() {
  const context = useContext(ReadingModeContext);
  if (context === undefined) {
    throw new Error('useReadingMode must be used within a ReadingModeProvider');
  }
  return context;
}
