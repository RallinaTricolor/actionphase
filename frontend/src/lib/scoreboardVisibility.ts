import { isPublicArchive } from './gamePermissions';
import type { ScoreboardVisibility } from '@/types/scoreboard';

/** Game states that show the tab. Before play starts there is nothing to rank. */
const SCOREBOARD_STATES: ReadonlySet<string> = new Set(['in_progress', 'paused', 'epilogue', 'completed']);

interface ScoreboardViewerInput {
  gameState: string | null | undefined;
  /** The game's "Enable scoreboard" setting. */
  enabled: boolean | undefined;
  /** Who the GM opened the board to. Absent means GM and audience only. */
  visibility: ScoreboardVisibility | undefined;
  /** GM authority: the GM, a co-GM, or an admin in admin mode. */
  isGM: boolean;
  /** Holds the audience role, or reads the game as a public archive. */
  isAudience: boolean;
}

/**
 * Whether this viewer gets the Scoreboard tab. Mirrors core.ScoreboardViewFor so
 * the tab appears only where the board will load. It decides nothing about the
 * data: the server filters every response itself.
 */
export function canViewScoreboard({
  gameState,
  enabled,
  visibility,
  isGM,
  isAudience,
}: ScoreboardViewerInput): boolean {
  if (!enabled || !gameState || !SCOREBOARD_STATES.has(gameState)) return false;
  return isGM || isAudience || isPublicArchive(gameState) || visibility === 'public';
}
