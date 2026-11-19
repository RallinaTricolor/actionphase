/**
 * Color names accepted by the [color:X]...[/color] markdown extension, in the
 * order shown in the editor's help legend.
 *
 * This list is mirrored in two other places, and all three must agree:
 *   - the [data-color="..."] rules in src/index.css, which supply the actual
 *     light- and dark-mode values
 *   - textColors in backend/pkg/core/text_colors.go, which exports use to
 *     unwrap the syntax for downloadable archives and the scoreboard uses to
 *     measure range labels
 *
 * A name missing from the CSS renders unstyled; a name missing from the Go list
 * stays wrapped in literal [color:...] markup in exports, and counts against a
 * scoreboard label's length as text.
 *
 * These are roles, not literal hues — each name resolves to a different value
 * per theme so it stays legible against that theme's background. That rules out
 * "black" and "white" as color names: body text is already #111827 on light and
 * #fff on dark (see --color-content-primary in lib/theme/themes.ts), so they
 * could only duplicate the default or be unreadable in one theme.
 */
export const TEXT_COLORS = [
  'red', 'green', 'blue', 'purple', 'orange', 'gold', 'gray', 'teal', 'pink',
  'brown', 'olive', 'silver',
] as const;

export const ALLOWED_COLORS = new Set<string>(TEXT_COLORS);
