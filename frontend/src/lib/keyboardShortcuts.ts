import { NAVBAR_HEIGHT_PX } from '@/components/layout/TabNavigation';

/**
 * The app's keyboard shortcuts, in one place.
 *
 * Handlers match keys with the predicates here, and every surface that lists
 * shortcuts (the `?` cheat sheet, the editor's Markdown Help) renders
 * `SHORTCUT_GROUPS`. Keep the two together: the PM composer once advertised
 * Ctrl+Enter for months after its handler was lost, because the hint was a
 * hard-coded string nothing checked.
 *
 * Formatting combos (Ctrl/⌘+B/I/K) are matched by `formatForKey` in
 * `components/common/markdown/markdownHotkeys.ts`; they are listed here for
 * display only.
 */

/** Page-level single-key shortcuts. Never fire while typing in a field. */
export const HELP_KEY = '?';
/** `n` jumps to the next unread item, Shift+`n` to the previous one. */
export const UNREAD_KEY = 'n';

/** Marker for an element `n` should stop at. Set it only while the item is unread. */
export const UNREAD_ANCHOR_ATTR = 'data-unread-anchor';

/** Stand-in for Ctrl (Windows/Linux) or ⌘ (macOS) in `SHORTCUT_GROUPS`. */
export const MOD = 'Mod';

export interface ShortcutEntry {
  /** Keys pressed together. `MOD` renders per platform via `keyLabel`. */
  keys: string[];
  description: string;
}

export interface ShortcutGroup {
  id: 'page' | 'editor' | 'suggestions';
  title: string;
  shortcuts: ShortcutEntry[];
}

export const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    id: 'page',
    title: 'Anywhere (outside a text box)',
    shortcuts: [
      { keys: [HELP_KEY], description: 'Show keyboard shortcuts' },
      { keys: [UNREAD_KEY], description: 'Jump to the next unread comment or message' },
      { keys: ['Shift', UNREAD_KEY], description: 'Jump to the previous unread comment or message' },
      { keys: ['Esc'], description: 'Close a dialog or drawer' },
    ],
  },
  {
    id: 'editor',
    title: 'In a text editor',
    shortcuts: [
      { keys: [MOD, 'Enter'], description: 'Send / submit' },
      { keys: ['Esc'], description: 'Cancel (asks first if you have typed anything)' },
      { keys: [MOD, 'B'], description: 'Bold' },
      { keys: [MOD, 'I'], description: 'Italic' },
      { keys: [MOD, 'K'], description: 'Link' },
    ],
  },
  {
    id: 'suggestions',
    title: 'Mention and sheet-item suggestions (@ and %%)',
    shortcuts: [
      { keys: ['↑', '↓'], description: 'Choose a suggestion' },
      { keys: ['Tab'], description: 'Insert the highlighted suggestion (Enter also works)' },
      { keys: ['Esc'], description: 'Dismiss suggestions' },
    ],
  },
];

export function isMacPlatform(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent);
}

/** Display label for one key, resolving `MOD` for the current platform. */
export function keyLabel(key: string, mac = isMacPlatform()): string {
  if (key !== MOD) return key;
  return mac ? '⌘' : 'Ctrl';
}

interface KeyCombo {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
}

/** Ctrl+Enter or ⌘+Enter: submit the editor's form. Alt is left to the OS. */
export function isSubmitCombo(e: KeyCombo): boolean {
  return e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !e.altKey;
}

const NON_TEXT_INPUT_TYPES = new Set([
  'button', 'checkbox', 'color', 'file', 'hidden', 'image', 'radio', 'range', 'reset', 'submit',
]);

/**
 * True when keystrokes on this target produce text, so a single-key shortcut
 * must stand aside. Without this, every `?` typed in a comment would open the
 * cheat sheet.
 */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return true;
  if (target instanceof HTMLInputElement) return !NON_TEXT_INPUT_TYPES.has(target.type);
  return false;
}

/** Height of the sticky chrome (nav + game tab bar) covering the top of the viewport. */
function stickyChromeHeight(): number {
  const tabBar = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--game-tabbar-h')) || 0;
  return NAVBAR_HEIGHT_PX + tabBar;
}

let lastJumpTarget: Element | null = null;

export type UnreadDirection = 'next' | 'previous';

/**
 * Picks the unread anchor to jump to, given anchors in document order.
 *
 * Steps on from the previous jump while that item is still on screen, so
 * repeated presses walk the list even though each jump leaves the target
 * mid-viewport. Otherwise -- first press, or the reader has scrolled away --
 * it starts from the visible page: forward, the first anchor at or below its
 * top; backward, the last anchor above it. Off either end it wraps around.
 */
export function pickUnread(
  anchors: Element[],
  direction: UnreadDirection,
  { previous, visibleTop, viewportHeight }: { previous: Element | null; visibleTop: number; viewportHeight: number }
): Element | null {
  if (anchors.length === 0) return null;
  const step = direction === 'next' ? 1 : -1;

  let index: number | null = null;
  const previousIndex = previous ? anchors.indexOf(previous) : -1;
  if (previousIndex !== -1) {
    const rect = anchors[previousIndex].getBoundingClientRect();
    if (rect.bottom > visibleTop && rect.top < viewportHeight) index = previousIndex + step;
  }
  if (index === null) {
    const isAhead = (anchor: Element) => anchor.getBoundingClientRect().top >= visibleTop;
    // Backward: the last anchor before the first one ahead (-1 when none is behind)
    const firstAhead = anchors.findIndex(isAhead);
    index = direction === 'next' ? firstAhead : (firstAhead === -1 ? anchors.length : firstAhead) - 1;
  }
  // Off either end (or nothing in that direction): wrap around
  if (index < 0 || index >= anchors.length) index = direction === 'next' ? 0 : anchors.length - 1;
  return anchors[index];
}

/**
 * Scrolls the next (or previous) unread item on the page into view and
 * flashes it, using the same ring as comment deep links. Returns false when
 * the page has no unread items, so the caller can say so.
 *
 * Only reaches what is rendered: unread comments in a collapsed thread or a
 * page not yet loaded are not on the page to jump to.
 */
export function jumpToUnread(direction: UnreadDirection): boolean {
  const anchors = Array.from(document.querySelectorAll(`[${UNREAD_ANCHOR_ATTR}]`)).filter(
    // Skip anchors in hidden subtrees (collapsed threads, display:none layouts)
    (el) => el.getClientRects().length > 0 && !el.closest('[role="dialog"]')
  );
  const target = pickUnread(anchors, direction, {
    previous: lastJumpTarget,
    visibleTop: stickyChromeHeight(),
    viewportHeight: window.innerHeight,
  });
  if (!target) return false;

  lastJumpTarget = target;
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });

  // Remove only what we added: an unread comment already carries rounded-lg.
  const added = ['ring-2', 'ring-interactive-primary', 'rounded-lg'].filter((c) => !target.classList.contains(c));
  target.classList.add(...added);
  setTimeout(() => target.classList.remove(...added), 1500);
  return true;
}
