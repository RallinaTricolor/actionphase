import { useState, useEffect } from 'react';

interface CountdownTimerProps {
  deadline: string;
  className?: string;
  onExpired?: () => void;
}

interface TimeRemaining {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  total: number;
}

export function CountdownTimer({ deadline, className = '', onExpired }: CountdownTimerProps) {
  const [timeRemaining, setTimeRemaining] = useState<TimeRemaining>({
    days: 0, hours: 0, minutes: 0, seconds: 0, total: 0
  });

  const calculateTimeRemaining = (deadline: string): TimeRemaining => {
    const now = new Date().getTime();
    const target = new Date(deadline).getTime();
    const difference = target - now;

    if (difference > 0) {
      const days = Math.floor(difference / (1000 * 60 * 60 * 24));
      const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((difference % (1000 * 60)) / 1000);

      return { days, hours, minutes, seconds, total: difference };
    }

    return { days: 0, hours: 0, minutes: 0, seconds: 0, total: 0 };
  };

  useEffect(() => {
    const updateTimer = () => {
      const remaining = calculateTimeRemaining(deadline);
      setTimeRemaining(remaining);

      if (remaining.total <= 0 && onExpired) {
        onExpired();
      }
    };

    // Update immediately
    updateTimer();

    // Update every second
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [deadline, onExpired]);

  const formatTime = (value: number): string => {
    return value.toString().padStart(2, '0');
  };

  const isExpired = timeRemaining.total <= 0;
  const isUrgent = timeRemaining.total <= 5 * 60 * 1000; // Less than 5 minutes
  const isWarning = timeRemaining.total <= 30 * 60 * 1000; // Less than 30 minutes

  if (isExpired) {
    return (
      <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800 ${className}`}>
        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Time Expired
      </div>
    );
  }

  const timerColor = isUrgent
    ? 'bg-red-100 text-red-800 border-red-200'
    : isWarning
    ? 'bg-yellow-100 text-yellow-800 border-yellow-200'
    : 'bg-blue-100 text-blue-800 border-blue-200';

  const pulseClass = isUrgent ? 'animate-pulse' : '';

  return (
    <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${timerColor} ${pulseClass} ${className}`}>
      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <div className="flex items-center space-x-1 font-mono">
        {timeRemaining.days > 0 && (
          <>
            <span>{timeRemaining.days}d</span>
            <span className="opacity-50">:</span>
          </>
        )}
        <span>{formatTime(timeRemaining.hours)}</span>
        <span className="opacity-50">:</span>
        <span>{formatTime(timeRemaining.minutes)}</span>
        <span className="opacity-50">:</span>
        <span>{formatTime(timeRemaining.seconds)}</span>
      </div>
    </div>
  );
}

interface SimpleCountdownProps {
  deadline: string;
  className?: string;
}

export function SimpleCountdown({ deadline, className = '' }: SimpleCountdownProps) {
  const [timeText, setTimeText] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date().getTime();
      const target = new Date(deadline).getTime();
      const difference = target - now;

      if (difference <= 0) {
        setTimeText('Expired');
        return;
      }

      const days = Math.floor(difference / (1000 * 60 * 60 * 24));
      const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));

      if (days > 0) {
        setTimeText(`${days}d ${hours}h`);
      } else if (hours > 0) {
        setTimeText(`${hours}h ${minutes}m`);
      } else {
        setTimeText(`${minutes}m`);
      }
    };

    updateTime();
    const interval = setInterval(updateTime, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [deadline]);

  return (
    <span className={`text-sm ${className}`}>
      {timeText}
    </span>
  );
}
