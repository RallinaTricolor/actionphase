import { createContext, useContext } from 'react';
import type { PhaseRewards } from '@/hooks/usePhaseRewards';

/** The phase's rewards, for every step of the board (see usePhaseRewards). GmBoard provides it. */
export const BoardRewardsContext = createContext<PhaseRewards | null>(null);

/** The phase's rewards. Only inside GmBoard. */
export function useBoardRewards(): PhaseRewards {
  const value = useContext(BoardRewardsContext);
  if (!value) throw new Error('useBoardRewards must be used inside the results board');
  return value;
}

/** The phase's rewards, or null outside the board (a step rendered on its own in a test). */
export function useOptionalBoardRewards(): PhaseRewards | null {
  return useContext(BoardRewardsContext);
}
