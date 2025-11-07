import React from 'react';
import { useReadingMode } from '../contexts/ReadingModeContext';

/**
 * ThreadModal Component
 *
 * Modal overlay for viewing deep comment threads within reading mode.
 * Appears on top of the reading mode overlay without navigating away.
 *
 * Features:
 * - Layered on top of reading mode (z-index 110 vs 100)
 * - Keyboard shortcut (Esc to close)
 * - Click backdrop to close
 * - Scrollable content area
 */
export function ThreadModal() {
  const { threadModal, closeThreadModal, fontSize } = useReadingMode();

  if (!threadModal.isOpen || !threadModal.content) {
    return null;
  }

  const fontSizeClasses = {
    normal: 'text-base',
    large: 'text-lg',
    xlarge: 'text-xl',
  };

  return (
    <div
      className="fixed inset-0 z-[110] overflow-y-auto"
      style={{
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
      }}
      onClick={(e) => {
        // Close when clicking the backdrop (not the content)
        if (e.target === e.currentTarget) {
          closeThreadModal();
        }
      }}
    >
      <div className="min-h-screen flex items-start justify-center py-8 px-4 sm:px-6 lg:px-8">
        <div
          className={`
            w-full max-w-[70ch]
            bg-surface-page
            rounded-lg
            shadow-xl
            ${fontSizeClasses[fontSize]}
          `}
          style={{
            backgroundColor: 'rgb(var(--color-surface-page))',
          }}
        >
          {/* Header with close button */}
          <div className="sticky top-0 bg-inherit py-4 px-6 z-10 border-b border-border-primary flex items-center justify-between rounded-t-lg">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium opacity-70">Thread View</span>
              <kbd className="px-2 py-1 text-xs font-mono bg-surface-raised rounded border border-border-primary opacity-70">
                Esc
              </kbd>
            </div>
            <button
              onClick={closeThreadModal}
              className="p-2 hover:bg-surface-raised rounded-lg transition-colors"
              aria-label="Close thread view"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="p-6">
            {threadModal.content}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ThreadModal;
