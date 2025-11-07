import { useReadingMode } from '../contexts/ReadingModeContext';
import type { ReadingModeTheme } from '../contexts/ReadingModeContext';
import { ThreadModal } from './ThreadModal';

const themeClasses: Record<ReadingModeTheme, string> = {
  default: 'bg-surface-page text-content-primary',
  sepia: 'bg-surface-page text-content-primary',
  dark: 'bg-surface-page text-content-primary',
};

const fontSizeClasses = {
  normal: 'text-base',
  large: 'text-lg',
  xlarge: 'text-xl',
};

/**
 * ReadingModeOverlay Component
 *
 * Full-screen modal overlay for focused reading mode.
 * Displays post and comments with optimal typography and layout.
 *
 * Features:
 * - Full-screen overlay with backdrop
 * - 70ch max-width for optimal readability
 * - Theme variants (default, sepia, dark)
 * - Keyboard shortcuts (Alt+R, Esc)
 */
export function ReadingModeOverlay() {
  const { isActive, content, theme, fontSize, exitReadingMode } = useReadingMode();

  if (!isActive || !content) {
    return null;
  }

  return (
    <>
      <div
        className={`
          fixed inset-0 z-[100] overflow-y-auto
          ${themeClasses[theme]}
          transition-all duration-300 ease-in-out
        `}
        style={{
          scrollbarGutter: 'stable',
          backgroundColor: 'rgb(var(--color-surface-page))',
        }}
        onClick={(e) => {
          // Close when clicking the backdrop (not the content)
          if (e.target === e.currentTarget) {
            exitReadingMode();
          }
        }}
      >
        <div className="min-h-screen flex items-start justify-center py-8 px-4 sm:px-6 lg:px-8">
          <div
            className={`
              w-full max-w-[70ch]
              ${fontSizeClasses[fontSize]}
              leading-relaxed
            `}
            style={{
              lineHeight: 1.8,
            }}
          >
            {/* Header with controls */}
            <div className="mb-8 flex items-center justify-between sticky top-0 bg-inherit py-4 z-10 border-b border-border-primary">
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium opacity-70">Reading Mode</span>
                <kbd className="px-2 py-1 text-xs font-mono bg-surface-raised rounded border border-border-primary opacity-70">
                  Alt+R
                </kbd>
                <kbd className="px-2 py-1 text-xs font-mono bg-surface-raised rounded border border-border-primary opacity-70">
                  Esc
                </kbd>
              </div>
              <button
                onClick={exitReadingMode}
                className="p-2 hover:bg-surface-raised rounded-lg transition-colors"
                aria-label="Exit reading mode"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <article className="max-w-none">
              {content}
            </article>
          </div>
        </div>
      </div>

      {/* Thread modal overlay (appears on top of reading mode) */}
      <ThreadModal />
    </>
  );
}

export default ReadingModeOverlay;
