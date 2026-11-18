import { createContext } from 'react';

/**
 * Where a step's toolbar goes: the slot under the step tabs in the board's
 * header block. `undefined` outside a board (a step rendered on its own, as in
 * its tests), so the toolbar renders in place; `null` while the board's slot
 * is mounting, so the toolbar waits rather than rendering twice.
 */
export const BoardToolbarSlotContext = createContext<HTMLElement | null | undefined>(undefined);

/**
 * A pane that stays in view while the page scrolls: below the site's sticky
 * nav (4rem) with a 1rem gap, and no taller than the window below it.
 */
export const PANE_STICKY = 'sticky top-20 self-start max-h-[calc(100vh-6rem)]';

/** A second or later row of a step's toolbar, ruled off from the one above. */
export const TOOLBAR_ROW = 'flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-theme-default pt-2';

/** A small label in front of a toolbar group ("Here", "After the scene"). */
export const TOOLBAR_LABEL = 'text-xs font-semibold uppercase tracking-wide text-content-tertiary';
