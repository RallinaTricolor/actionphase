import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { waitFor } from '@testing-library/react';
import { ThemeProvider } from './ThemeContext';
import { renderWithProviders } from '../test-utils/render';

describe('ThemeProvider: color-scheme', () => {
  beforeEach(() => {
    // ThemeProvider queries prefers-color-scheme; jsdom has no matchMedia implementation.
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
  });

  afterEach(() => {
    localStorage.removeItem('app-theme');
    document.documentElement.style.colorScheme = '';
  });

  // Native controls (scrollbars, checkboxes) follow color-scheme, not the
  // theme's CSS variables, so a dark theme without it shows white scrollbars.
  it.each([
    ['dark', 'dark'],
    ['highContrastDark', 'dark'],
    ['light', 'light'],
    ['highContrast', 'light'],
    ['colorblind', 'light'],
  ])('sets color-scheme %s → %s on the document', async (theme, scheme) => {
    localStorage.setItem('app-theme', theme);

    renderWithProviders(<ThemeProvider><div /></ThemeProvider>);

    await waitFor(() => expect(document.documentElement.style.colorScheme).toBe(scheme));
  });
});
