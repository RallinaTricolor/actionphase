import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import type { UnifiedDeadline } from '../types/deadlines';

export type DeadlineUrgency = 'critical' | 'warning' | 'normal' | 'expired';

interface DeadlineCardProps {
  deadline: UnifiedDeadline;
  isGM: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  onExtend?: () => void;
  onClick?: () => void;
}

/**
 * Calculate urgency level based on hours until deadline
 * - critical (red): < 24 hours
 * - warning (yellow): 24-48 hours
 * - normal (blue): > 48 hours
 * - expired (gray): past deadline
 */
function calculateUrgency(deadlineStr?: string): DeadlineUrgency {
  if (!deadlineStr) return 'normal';

  try {
    const deadlineDate = new Date(deadlineStr);
    const now = new Date();
    const hoursRemaining = (deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (hoursRemaining < 0) return 'expired';
    if (hoursRemaining < 24) return 'critical';
    if (hoursRemaining < 48) return 'warning';
    return 'normal';
  } catch {
    return 'normal';
  }
}

/**
 * Format countdown in compact format (e.g., "18h 23m", "2d 3h")
 */
function formatCountdown(deadlineStr?: string): string {
  if (!deadlineStr) return '';

  try {
    const deadlineDate = new Date(deadlineStr);
    const now = new Date();
    const ms = deadlineDate.getTime() - now.getTime();

    if (ms < 0) return 'Expired';

    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));

    if (hours >= 24) {
      const days = Math.floor(hours / 24);
      const remainingHours = hours % 24;
      return `${days}d ${remainingHours}h`;
    }

    return `${hours}h ${minutes}m`;
  } catch {
    return '';
  }
}

/**
 * Get icon for deadline based on title keywords
 */
function getDeadlineIcon(title: string): string {
  const lowerTitle = title.toLowerCase();
  if (lowerTitle.includes('poll') || lowerTitle.includes('vote')) return '🗳️';
  if (lowerTitle.includes('phase') || lowerTitle.includes('transition')) return '⏰';
  if (lowerTitle.includes('action') || lowerTitle.includes('submit')) return '📝';
  if (lowerTitle.includes('character') || lowerTitle.includes('creation')) return '👤';
  return '📌';
}

/**
 * DeadlineCard - Compact horizontal card for displaying a single deadline
 *
 * Features:
 * - Color-coded border based on urgency
 * - Real-time countdown timer
 * - Icon based on deadline type
 * - GM edit/delete actions on hover
 * - Clickable to navigate to relevant content
 *
 * @example
 * ```tsx
 * <DeadlineCard
 *   deadline={deadline}
 *   isGM={true}
 *   onEdit={() => handleEdit(deadline)}
 *   onDelete={() => handleDelete(deadline)}
 * />
 * ```
 */
export function DeadlineCard({ deadline, isGM, onEdit, onDelete, onExtend, onClick }: DeadlineCardProps) {
  const [countdown, setCountdown] = useState(formatCountdown(deadline.deadline));
  const [urgency, setUrgency] = useState(calculateUrgency(deadline.deadline));
  const [showActions, setShowActions] = useState(false);

  // Update countdown every minute
  useEffect(() => {
    const updateCountdown = () => {
      setCountdown(formatCountdown(deadline.deadline));
      setUrgency(calculateUrgency(deadline.deadline));
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [deadline.deadline]);

  // Urgency color classes
  const urgencyClasses = {
    critical: 'border-semantic-danger bg-semantic-danger-subtle',
    warning: 'border-semantic-warning bg-semantic-warning-subtle',
    normal: 'border-interactive-primary bg-interactive-primary-subtle',
    expired: 'border-border-secondary bg-surface-secondary opacity-60',
  };

  const urgencyTextClasses = {
    critical: 'text-semantic-danger',
    warning: 'text-semantic-warning',
    normal: 'text-interactive-primary',
    expired: 'text-content-tertiary',
  };

  const icon = getDeadlineIcon(deadline.title);
  const formattedDate = deadline.deadline ? format(new Date(deadline.deadline), 'MMM d, h:mm a') : '';

  // Truncate title if too long
  const displayTitle = deadline.title.length > 20 ? deadline.title.slice(0, 20) + '...' : deadline.title;

  return (
    <div
      className={`
        relative rounded-lg border-2 p-3 min-w-[180px] max-w-[200px]
        transition-all duration-200
        ${urgencyClasses[urgency]}
        ${onClick ? 'cursor-pointer hover:shadow-md' : ''}
        ${isGM ? 'hover:shadow-md' : ''}
      `}
      onClick={onClick}
      onMouseEnter={() => isGM && setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
      title={deadline.title} // Show full title on hover
    >
      {/* GM Actions (shown on hover) */}
      {isGM && showActions && (
        <div className="absolute top-1 right-1 flex gap-1 z-10">
          {onEdit && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              className="p-1 rounded bg-surface-page hover:bg-surface-raised transition-colors"
              aria-label="Edit deadline"
              title="Edit deadline"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
          )}
          {onExtend && urgency !== 'expired' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onExtend();
              }}
              className="p-1 rounded bg-surface-page hover:bg-surface-raised transition-colors"
              aria-label="Extend deadline"
              title="Extend deadline"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
          )}
          {onDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="p-1 rounded bg-surface-page hover:bg-semantic-danger-subtle transition-colors text-semantic-danger"
              aria-label="Delete deadline"
              title="Delete deadline"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>
      )}

      {/* Icon + Title */}
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xl">{icon}</span>
        <span className="text-sm font-semibold text-content-primary truncate" title={deadline.title}>
          {displayTitle}
        </span>
      </div>

      {/* Countdown */}
      {countdown && (
        <div className={`text-2xl font-bold mb-1 ${urgencyTextClasses[urgency]}`}>
          {countdown}
        </div>
      )}

      {/* Date/Time */}
      {formattedDate && (
        <div className="text-xs text-content-secondary">
          {urgency === 'expired' ? 'Due: ' : ''}{formattedDate}
        </div>
      )}
    </div>
  );
}
