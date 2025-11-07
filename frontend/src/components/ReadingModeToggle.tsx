import React from 'react';
import { useReadingMode } from '../contexts/ReadingModeContext';
import { Button } from './ui';

interface ReadingModeToggleProps {
  className?: string;
  showLabel?: boolean;
  content: React.ReactNode; // The content to display in reading mode
}

/**
 * ReadingModeToggle Component
 *
 * Button to enter reading mode with the provided content.
 * Shows the enter icon and can display an optional label.
 *
 * @example
 * <ReadingModeToggle content={post.content} showLabel={true} />
 */
export function ReadingModeToggle({ className = '', showLabel = false, content }: ReadingModeToggleProps) {
  const { enterReadingMode } = useReadingMode();

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => enterReadingMode(content)}
      className={`flex items-center gap-2 ${className}`}
      title="Enter Reading Mode"
    >
        <>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
          {showLabel && <span>Focus Mode</span>}
        </>
    </Button>
  );
}

export default ReadingModeToggle;
