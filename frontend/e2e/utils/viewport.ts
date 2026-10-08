import { Page } from '@playwright/test';

/**
 * Tailwind's `md` breakpoint. Below it the app renders its mobile navigation:
 * the hamburger menu (Layout), and <select> dropdowns in place of tab bars
 * (TabNavigation, SettingsSidebar, character-sheet module tabs).
 */
const MD_BREAKPOINT_PX = 768;

/**
 * Whether the page is rendering the mobile layout.
 *
 * Decided from the viewport, never from the DOM. The previous idiom --
 * `await mobileSelect.isVisible({ timeout: 2000 })` -- looks like a 2s wait but
 * is not one: isVisible() ignores `timeout` and answers immediately. Asked
 * before the page had rendered its tabs, it returned false on a phone-sized
 * viewport and sent the helper down the desktop path.
 */
export function isMobileViewport(page: Page): boolean {
  const width = page.viewportSize()?.width;
  if (width === undefined) {
    throw new Error('isMobileViewport: page has no fixed viewport');
  }
  return width < MD_BREAKPOINT_PX;
}
