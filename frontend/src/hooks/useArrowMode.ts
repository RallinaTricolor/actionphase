import { useCallback, useState } from 'react';
import { isArrowMode, type ArrowMode } from '@/lib/gmBoard/arrows';

const STORAGE_KEY = 'gmBoardArrows';

const read = (): ArrowMode => {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return isArrowMode(v) ? v : 'hover';
  } catch {
    return 'hover';
  }
};

/**
 * How the results board's Map draws causes (On hover, All, Off). A display
 * preference kept in this browser for every game, like a theme; it is not
 * board data, so viewers keep one too. Starts on hover.
 */
export function useArrowMode(): [ArrowMode, (mode: ArrowMode) => void] {
  const [mode, setMode] = useState<ArrowMode>(read);
  const set = useCallback((next: ArrowMode) => {
    setMode(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Private window or blocked storage: the choice lasts until reload.
    }
  }, []);
  return [mode, set];
}
