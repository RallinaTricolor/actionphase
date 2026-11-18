import { createContext, useContext } from 'react';

/**
 * Whether the results board (or its Game setup page) is open read-only: for a
 * viewer the GM shares it with, for the GM once the game is archived, or for
 * the GM of a board whose phase has ended.
 * Read-only means no editing controls, and the board and settings stores
 * drop edits, so nothing is saved and no draft is kept in the browser.
 * The board still polls.
 */
export const BoardReadOnlyContext = createContext(false);

/**
 * Receives text from a result editor that closed without being able to save
 * it, because the phase stopped being active. The board shows it so it can be
 * copied.
 */
export const BoardUnsavedTextContext = createContext<((label: string, text: string) => void) | null>(null);

export function useBoardReadOnly(): boolean {
  return useContext(BoardReadOnlyContext);
}
