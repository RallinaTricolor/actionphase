import { createContext, useContext } from 'react';

/**
 * Whether the results board (or its Game setup page) is open read-only: for a
 * viewer the GM shares it with, or for the GM once the game is archived.
 * Read-only means no editing controls, and the board and settings stores
 * drop edits, so nothing is saved and no draft is kept in the browser.
 * The board still polls.
 */
export const BoardReadOnlyContext = createContext(false);

export function useBoardReadOnly(): boolean {
  return useContext(BoardReadOnlyContext);
}
