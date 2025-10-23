/**
 * Semantic design tokens for the theme system.
 * These abstract away from specific color values, providing meaningful names
 * that describe the purpose of each color rather than its implementation.
 *
 * Benefits:
 * - Theme-agnostic: tokens work across all themes (light, dark, high-contrast, etc.)
 * - Semantic naming: "surface-base" is clearer than "gray-800"
 * - Maintainability: change colors in themes.ts, all components update
 * - Type safety: TypeScript autocomplete for all tokens
 *
 * @example
 * // Instead of: bg-white dark:bg-gray-800
 * // Use: surface-base
 * <div className="surface-base">...</div>
 */

export const tokens = {
  /**
   * Surface tokens - for backgrounds and containers
   *
   * - base: Primary surface color (cards, modals, main backgrounds)
   * - raised: Slightly elevated surface (hover states, active tabs)
   * - overlay: Dropdown menus, popovers, tooltips
   * - sunken: Recessed areas, input backgrounds, code blocks
   */
  surface: {
    base: 'surface-base',
    raised: 'surface-raised',
    overlay: 'surface-overlay',
    sunken: 'surface-sunken',
  },

  /**
   * Content tokens - for text and foreground elements
   *
   * - primary: Main body text, headings
   * - secondary: Supporting text, labels
   * - tertiary: Muted text, placeholders
   * - disabled: Disabled state text
   * - inverse: Text on colored backgrounds (e.g., white on blue)
   */
  content: {
    primary: 'text-content-primary',
    secondary: 'text-content-secondary',
    tertiary: 'text-content-tertiary',
    disabled: 'text-content-disabled',
    inverse: 'text-content-inverse',
  },

  /**
   * Interactive tokens - for buttons and interactive elements
   *
   * - primary: Primary action buttons
   * - primaryHover: Primary button hover state
   * - secondary: Secondary/outline buttons
   * - secondaryHover: Secondary button hover state
   */
  interactive: {
    primary: 'bg-interactive-primary',
    primaryHover: 'hover:bg-interactive-primary-hover',
    secondary: 'bg-interactive-secondary',
    secondaryHover: 'hover:bg-interactive-secondary-hover',
  },

  /**
   * Semantic tokens - for status and feedback
   *
   * Each semantic color has two variants:
   * - Base: Solid color for badges, icons, borders
   * - Subtle: Light background for alerts, banners
   */
  semantic: {
    danger: 'bg-semantic-danger',
    dangerSubtle: 'bg-semantic-danger-subtle',
    warning: 'bg-semantic-warning',
    warningSubtle: 'bg-semantic-warning-subtle',
    success: 'bg-semantic-success',
    successSubtle: 'bg-semantic-success-subtle',
    info: 'bg-semantic-info',
    infoSubtle: 'bg-semantic-info-subtle',
  },

  /**
   * Border tokens - for borders and dividers
   *
   * - default: Standard borders, input outlines
   * - subtle: Light dividers, subtle separators
   * - strong: Emphasized borders, focus rings
   */
  border: {
    default: 'border-theme-default',
    subtle: 'border-theme-subtle',
    strong: 'border-theme-strong',
  },
} as const;

// Type exports for better TypeScript support
export type TokenCategory = keyof typeof tokens;
export type SurfaceToken = keyof typeof tokens.surface;
export type ContentToken = keyof typeof tokens.content;
export type InteractiveToken = keyof typeof tokens.interactive;
export type SemanticToken = keyof typeof tokens.semantic;
export type BorderToken = keyof typeof tokens.border;
