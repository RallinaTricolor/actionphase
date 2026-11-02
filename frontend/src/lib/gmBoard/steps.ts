/** The board's steps, in the order a GM works through a phase. */
export const BOARD_STEPS = [
  { id: 'read', label: 'Read' },
  { id: 'map', label: 'Map' },
  { id: 'scenes', label: 'Scenes' },
  { id: 'write', label: 'Write' },
] as const;

export type BoardStep = (typeof BOARD_STEPS)[number]['id'];

/** The step named in the URL (`?step=`), or Read for a missing or unknown one. */
export function parseBoardStep(value: string | null): BoardStep {
  return BOARD_STEPS.some((s) => s.id === value) ? (value as BoardStep) : 'read';
}

/** The board's own URL. */
export const boardPath = (gameId: number, phaseId: number, step?: BoardStep) =>
  `/games/${gameId}/phases/${phaseId}/board${step && step !== 'read' ? `?step=${step}` : ''}`;

/** The GM's results area on the game page, which the board was opened from. */
export const resultsAreaPath = (gameId: number) => `/games/${gameId}?tab=actions`;

export const boardSetupPath = (gameId: number) => `/games/${gameId}/board-setup`;
