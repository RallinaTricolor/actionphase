/**
 * The board's tabs: its steps, in the order a GM works through a phase, then
 * the codex and the notes, which get a whole tab each so there's room to write.
 */
export const BOARD_STEPS = [
  { id: 'read', label: 'Read' },
  { id: 'map', label: 'Map' },
  { id: 'scenes', label: 'Scenes' },
  { id: 'write', label: 'Write' },
  { id: 'codex', label: 'Codex' },
  { id: 'notes', label: 'Notes' },
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

/** Game setup. `from`: the board URL it was opened from, so setup can send the GM straight back there. */
export const boardSetupPath = (gameId: number, from?: string) => `/games/${gameId}/board-setup${from ? `?from=${encodeURIComponent(from)}` : ''}`;

/** Where Game setup's "Back to the board" goes: `from`, when it's one of this game's boards (never anywhere else). */
export function boardReturnPath(gameId: number, from: string | null): string | null {
  if (!from) return null;
  return new RegExp(`^/games/${gameId}/phases/\\d+/board(?:\\?[^#]*)?$`).test(from) ? from : null;
}

/** A phase in the game's History tab, where viewers browse past phases. */
export const historyPhasePath = (gameId: number, phaseId: number) => `/games/${gameId}?tab=history&phase=${phaseId}`;
