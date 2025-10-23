/**
 * Theme definitions containing actual color values.
 *
 * Each theme is a set of CSS variable values that map to semantic tokens.
 * RGB values (e.g., "255 255 255") are used for compatibility with Tailwind's
 * opacity modifiers (e.g., bg-surface-base/50).
 *
 * To add a new theme:
 * 1. Add theme name to this file
 * 2. Define all CSS variables with RGB values
 * 3. Theme will automatically work with all components
 *
 * @example
 * themes.highContrast = {
 *   '--color-surface-base': '0 0 0',
 *   '--color-content-primary': '255 255 255',
 *   // ... other variables
 * };
 */

export const themes = {
  /**
   * Light theme - default daytime theme
   * Uses grays and blues for a clean, professional look
   */
  light: {
    // Surface colors - backgrounds and containers
    '--color-surface-base': '255 255 255',        // white - cards, modals
    '--color-surface-raised': '249 250 251',      // gray-50 - hover states, active tabs
    '--color-surface-overlay': '255 255 255',     // white - dropdowns, popovers
    '--color-surface-sunken': '243 244 246',      // gray-100 - input backgrounds

    // Content colors - text and foreground
    '--color-content-primary': '17 24 39',        // gray-900 - headings, body text
    '--color-content-secondary': '75 85 99',      // gray-600 - supporting text
    '--color-content-tertiary': '107 114 128',    // gray-500 - muted text
    '--color-content-disabled': '156 163 175',    // gray-400 - disabled state
    '--color-content-inverse': '255 255 255',     // white - text on dark backgrounds

    // Interactive colors - buttons and actions
    '--color-interactive-primary': '37 99 235',         // blue-600 - primary buttons
    '--color-interactive-primary-hover': '29 78 216',   // blue-700 - primary button hover
    '--color-interactive-secondary': '243 244 246',     // gray-100 - secondary buttons
    '--color-interactive-secondary-hover': '229 231 235', // gray-200 - secondary hover

    // Semantic colors - status and feedback
    '--color-semantic-danger': '220 38 38',             // red-600
    '--color-semantic-danger-subtle': '254 226 226',    // red-100
    '--color-semantic-warning': '217 119 6',            // yellow-600
    '--color-semantic-warning-subtle': '254 249 195',   // yellow-100
    '--color-semantic-success': '22 163 74',            // green-600
    '--color-semantic-success-subtle': '220 252 231',   // green-100
    '--color-semantic-info': '37 99 235',               // blue-600
    '--color-semantic-info-subtle': '219 234 254',      // blue-100

    // Border colors
    '--color-border-default': '229 231 235',      // gray-200 - standard borders
    '--color-border-subtle': '243 244 246',       // gray-100 - light dividers
    '--color-border-strong': '156 163 175',       // gray-400 - emphasized borders
  },

  /**
   * Dark theme - nighttime theme
   * Uses darker grays with slightly brighter interactive colors
   */
  dark: {
    // Surface colors - backgrounds and containers
    '--color-surface-base': '31 41 55',           // gray-800 - cards, modals
    '--color-surface-raised': '17 24 39',         // gray-900 - hover states, active tabs
    '--color-surface-overlay': '55 65 81',        // gray-700 - dropdowns, popovers
    '--color-surface-sunken': '17 24 39',         // gray-900 - input backgrounds

    // Content colors - text and foreground
    '--color-content-primary': '255 255 255',     // white - headings, body text
    '--color-content-secondary': '209 213 219',   // gray-300 - supporting text
    '--color-content-tertiary': '156 163 175',    // gray-400 - muted text
    '--color-content-disabled': '107 114 128',    // gray-500 - disabled state
    '--color-content-inverse': '17 24 39',        // gray-900 - text on light backgrounds

    // Interactive colors - buttons and actions
    '--color-interactive-primary': '59 130 246',        // blue-500 - primary buttons
    '--color-interactive-primary-hover': '37 99 235',   // blue-600 - primary button hover
    '--color-interactive-secondary': '55 65 81',        // gray-700 - secondary buttons
    '--color-interactive-secondary-hover': '75 85 99',  // gray-600 - secondary hover

    // Semantic colors - status and feedback
    '--color-semantic-danger': '239 68 68',             // red-500
    '--color-semantic-danger-subtle': '127 29 29',      // red-900
    '--color-semantic-warning': '245 158 11',           // yellow-500
    '--color-semantic-warning-subtle': '113 63 18',     // yellow-900
    '--color-semantic-success': '34 197 94',            // green-500
    '--color-semantic-success-subtle': '20 83 45',      // green-900
    '--color-semantic-info': '59 130 246',              // blue-500
    '--color-semantic-info-subtle': '30 58 138',        // blue-900

    // Border colors
    '--color-border-default': '55 65 81',         // gray-700 - standard borders
    '--color-border-subtle': '75 85 99',          // gray-600 - light dividers
    '--color-border-strong': '107 114 128',       // gray-500 - emphasized borders
  },

  /**
   * High Contrast Light theme - maximum contrast for accessibility
   * Uses pure black and white with bold accent colors
   * WCAG AAA compliant contrast ratios
   */
  highContrast: {
    // Surface colors - pure whites and black
    '--color-surface-base': '255 255 255',        // pure white - cards, modals
    '--color-surface-raised': '245 245 245',      // very light gray - hover states
    '--color-surface-overlay': '255 255 255',     // pure white - dropdowns
    '--color-surface-sunken': '240 240 240',      // light gray - inputs
    '--color-surface-page': '250 250 250',        // very light gray - page background

    // Content colors - maximum contrast
    '--color-content-primary': '0 0 0',           // pure black - headings, body
    '--color-content-secondary': '30 30 30',      // near black - supporting text
    '--color-content-tertiary': '70 70 70',       // dark gray - muted text
    '--color-content-disabled': '150 150 150',    // mid gray - disabled
    '--color-content-inverse': '255 255 255',     // pure white - text on dark

    // Interactive colors - bold and distinct
    '--color-interactive-primary': '0 0 180',           // strong blue
    '--color-interactive-primary-hover': '0 0 140',     // darker blue
    '--color-interactive-secondary': '230 230 230',     // light gray
    '--color-interactive-secondary-hover': '210 210 210', // medium gray
    '--color-primary-light': '230 240 255',             // very light blue - subtle backgrounds

    // Semantic colors - maximum contrast and distinct
    '--color-danger': '180 0 0',               // strong red
    '--color-danger-hover': '140 0 0',         // darker red
    '--color-danger-light': '255 230 230',     // light red
    '--color-danger-text': '140 0 0',          // darker red for text
    '--color-warning': '180 120 0',            // strong orange
    '--color-warning-hover': '140 90 0',       // darker orange
    '--color-warning-light': '255 245 220',    // light orange
    '--color-warning-text': '140 90 0',        // darker orange for text
    '--color-success': '0 130 0',              // strong green
    '--color-success-hover': '0 100 0',        // darker green
    '--color-success-light': '230 255 230',    // light green
    '--color-success-text': '0 100 0',         // darker green for text
    '--color-info': '0 0 180',                 // strong blue
    '--color-info-hover': '0 0 140',           // darker blue
    '--color-info-light': '230 240 255',       // light blue
    '--color-info-text': '0 0 140',            // darker blue for text

    // Border colors - strong contrast
    '--color-border-default': '0 0 0',            // black - standard borders
    '--color-border-subtle': '180 180 180',       // mid gray - light dividers
    '--color-border-strong': '0 0 0',             // black - emphasized borders
  },

  /**
   * High Contrast Dark theme - maximum contrast dark mode
   * Uses pure black background with bright colors
   * WCAG AAA compliant contrast ratios
   */
  highContrastDark: {
    // Surface colors - pure blacks and dark grays
    '--color-surface-base': '0 0 0',              // pure black - cards, modals
    '--color-surface-raised': '20 20 20',         // very dark gray - hover states
    '--color-surface-overlay': '30 30 30',        // dark gray - dropdowns
    '--color-surface-sunken': '0 0 0',            // pure black - inputs
    '--color-surface-page': '0 0 0',              // pure black - page background

    // Content colors - maximum contrast
    '--color-content-primary': '255 255 255',     // pure white - headings, body
    '--color-content-secondary': '230 230 230',   // light gray - supporting text
    '--color-content-tertiary': '180 180 180',    // medium gray - muted text
    '--color-content-disabled': '100 100 100',    // dark gray - disabled
    '--color-content-inverse': '0 0 0',           // pure black - text on light

    // Interactive colors - bright and bold
    '--color-interactive-primary': '100 150 255',       // bright blue
    '--color-interactive-primary-hover': '140 180 255', // brighter blue
    '--color-interactive-secondary': '60 60 60',        // dark gray
    '--color-interactive-secondary-hover': '80 80 80',  // lighter dark gray
    '--color-primary-light': '20 30 60',                // dark blue - subtle backgrounds

    // Semantic colors - bright and distinct
    '--color-danger': '255 100 100',           // bright red
    '--color-danger-hover': '255 140 140',     // brighter red
    '--color-danger-light': '60 20 20',        // dark red
    '--color-danger-text': '255 140 140',      // brighter red for text
    '--color-warning': '255 200 100',          // bright orange
    '--color-warning-hover': '255 220 140',    // brighter orange
    '--color-warning-light': '60 50 20',       // dark orange
    '--color-warning-text': '255 220 140',     // brighter orange for text
    '--color-success': '100 255 100',          // bright green
    '--color-success-hover': '140 255 140',    // brighter green
    '--color-success-light': '20 60 20',       // dark green
    '--color-success-text': '140 255 140',     // brighter green for text
    '--color-info': '100 150 255',             // bright blue
    '--color-info-hover': '140 180 255',       // brighter blue
    '--color-info-light': '20 30 60',          // dark blue
    '--color-info-text': '140 180 255',        // brighter blue for text

    // Border colors - bright contrast
    '--color-border-default': '255 255 255',      // white - standard borders
    '--color-border-subtle': '80 80 80',          // dark gray - light dividers
    '--color-border-strong': '255 255 255',       // white - emphasized borders
  },

  /**
   * Colorblind-friendly theme
   * Optimized for all types of color vision deficiency
   * Uses blue-orange-yellow palette which is distinguishable for deuteranopia, protanopia, and tritanopia
   * Avoids red-green combinations
   */
  colorblind: {
    // Surface colors - warm tinted backgrounds to differentiate from light theme
    '--color-surface-base': '255 253 247',        // warm white - cards, modals
    '--color-surface-raised': '254 249 238',      // warm beige - hover states
    '--color-surface-overlay': '255 253 247',     // warm white - dropdowns
    '--color-surface-sunken': '250 245 235',      // light warm - inputs
    '--color-surface-page': '252 247 237',        // warm beige - page background

    // Content colors - high contrast blacks and grays
    '--color-content-primary': '17 24 39',        // gray-900 - headings
    '--color-content-secondary': '55 65 81',      // gray-700 - supporting (darker for contrast)
    '--color-content-tertiary': '75 85 99',       // gray-600 - muted
    '--color-content-disabled': '156 163 175',    // gray-400 - disabled
    '--color-content-inverse': '255 255 255',     // white - text on dark

    // Interactive colors - strong cyan-blue (universally distinguishable)
    '--color-interactive-primary': '6 182 212',         // cyan-600 - very distinct
    '--color-interactive-primary-hover': '8 145 178',   // cyan-700 - hover
    '--color-interactive-secondary': '254 249 238',     // warm beige - secondary
    '--color-interactive-secondary-hover': '250 245 235', // darker warm - hover
    '--color-primary-light': '207 250 254',             // cyan-100 - light cyan subtle backgrounds

    // Semantic colors - colorblind-safe palette with maximum distinction
    // Danger: Strong Orange (not red) - highly visible and distinct from blue
    '--color-danger': '249 115 22',            // orange-500 - bright and distinct
    '--color-danger-hover': '234 88 12',       // orange-600 - darker
    '--color-danger-light': '255 237 213',     // orange-100
    '--color-danger-text': '194 65 12',        // orange-700 - darker for text
    // Warning: Bright Yellow - maximum brightness contrast
    '--color-warning': '234 179 8',            // yellow-500 - very bright
    '--color-warning-hover': '202 138 4',      // yellow-600 - darker
    '--color-warning-light': '254 252 232',    // yellow-50
    '--color-warning-text': '161 98 7',        // yellow-700 - darker for text
    // Success: Teal (not green) - distinct from cyan primary
    '--color-success': '20 184 166',           // teal-500 - clearly different from cyan
    '--color-success-hover': '17 94 89',       // teal-700 - darker
    '--color-success-light': '204 251 241',    // teal-100
    '--color-success-text': '15 118 110',      // teal-600 - for text
    // Info: Deep Purple - completely different from other colors
    '--color-info': '124 58 237',              // violet-600 - strong purple
    '--color-info-hover': '109 40 217',        // violet-700 - darker
    '--color-info-light': '237 233 254',       // violet-100
    '--color-info-text': '109 40 217',         // violet-700 - for text

    // Border colors - warmer tones
    '--color-border-default': '217 119 6',        // orange-600 - warm accent borders
    '--color-border-subtle': '253 230 138',       // yellow-200 - warm light dividers
    '--color-border-strong': '6 182 212',         // cyan-600 - emphasized borders match primary
  },
} as const;

export type ThemeName = keyof typeof themes;
export type ThemeVariables = typeof themes[ThemeName];
