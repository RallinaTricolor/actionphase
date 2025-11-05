import { useEffect, useState } from 'react';
import { formatDistanceToNow, isPast } from 'date-fns';
import { Badge } from './ui/Badge';

export interface DeadlineTimerProps {
  deadline: string; // ISO 8601 timestamp
  className?: string;
}

/**
 * DeadlineTimer - Displays relative time to deadline with auto-updating countdown
 *
 * Features:
 * - Shows relative time (e.g., "in 2 hours", "5 minutes ago")
 * - Auto-updates every minute
 * - Color-coded badges based on urgency:
 *   - Red (danger): Expired or <2 hours remaining
 *   - Yellow (warning): <24 hours remaining
 *   - Blue (primary): >24 hours remaining
 * - Handles invalid dates gracefully
 *
 * @example
 * ```tsx
 * <DeadlineTimer deadline="2024-12-31T23:59:59Z" />
 * ```
 */
export function DeadlineTimer({ deadline, className }: DeadlineTimerProps) {
  const [timeString, setTimeString] = useState<string>('');
  const [isExpired, setIsExpired] = useState<boolean>(false);

  useEffect(() => {
    const updateTimeString = () => {
      try {
        const deadlineDate = new Date(deadline);

        // Check if date is valid
        if (isNaN(deadlineDate.getTime())) {
          setTimeString('Invalid date');
          return;
        }

        const expired = isPast(deadlineDate);
        setIsExpired(expired);

        const relativeTime = formatDistanceToNow(deadlineDate, { addSuffix: true });
        setTimeString(relativeTime);
      } catch (error) {
        setTimeString('Invalid date');
      }
    };

    // Update immediately
    updateTimeString();

    // Update every minute
    const interval = setInterval(updateTimeString, 60000);

    return () => clearInterval(interval);
  }, [deadline]);

  // Determine badge variant based on time remaining
  const getVariant = () => {
    if (timeString === 'Invalid date') return 'neutral';
    if (isExpired) return 'danger';

    // Check time remaining and apply color coding
    // Red: <2 hours, Yellow: <24 hours, Blue: >24 hours
    try {
      const deadlineDate = new Date(deadline);
      const hoursUntilDeadline = (deadlineDate.getTime() - Date.now()) / (1000 * 60 * 60);

      if (hoursUntilDeadline < 2) return 'danger'; // Red for urgent (<2 hours)
      if (hoursUntilDeadline < 24) return 'warning'; // Yellow for soon (<24 hours)
      return 'primary'; // Blue for future (>24 hours)
    } catch {
      return 'neutral';
    }
  };

  return (
    <Badge variant={getVariant()} size="sm" className={className}>
      {isExpired ? '⏰ ' : '⏱️ '}
      {timeString}
    </Badge>
  );
}
