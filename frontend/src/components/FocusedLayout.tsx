import React from 'react';
import { useReadingMode } from '../contexts/ReadingModeContext';
import type { ReadingModeTheme } from '../contexts/ReadingModeContext';

interface FocusedLayoutProps {
  children: React.ReactNode;
  className?: string;
}

const themeClasses: Record<ReadingModeTheme, string> = {
  default: 'bg-surface-page text-content-primary',
  sepia: 'bg-[#f4ecd8] text-[#5c4e3a]',
  dark: 'bg-gray-900 text-gray-100',
};

const fontSizeClasses = {
  normal: 'text-base',
  large: 'text-lg',
  xlarge: 'text-xl',
};

/**
 * FocusedLayout Component
 *
 * Wrapper that applies reading mode styles when active.
 * Provides a centered, focused layout with optimal line length
 * and customizable theme/font size.
 *
 * Features:
 * - 70ch max-width for optimal readability
 * - Centered content layout
 * - Theme variants (default, sepia, dark)
 * - Font size options
 * - Smooth transitions
 *
 * @example
 * <FocusedLayout>
 *   <MarkdownPreview content={post.content} />
 * </FocusedLayout>
 */
export function FocusedLayout({ children, className = '' }: FocusedLayoutProps) {
  const { isActive, theme, fontSize } = useReadingMode();

  // Show focused layout when reading mode is active
  if (!isActive) {
    return <>{children}</>;
  }

  return (
    <div
      className={`
        reading-mode-focused
        fixed inset-0 z-40 overflow-y-auto
        ${themeClasses[theme]}
        transition-all duration-300 ease-in-out
        ${className}
      `}
      style={{
        scrollbarGutter: 'stable',
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
          {/* Theme and font size controls */}
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
          </div>

          {/* Content */}
          <article className="prose prose-lg max-w-none">
            {children}
          </article>
        </div>
      </div>
    </div>
  );
}

export default FocusedLayout;
