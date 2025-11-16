/**
 * Timezone Utilities
 *
 * Provides consistent timezone handling across the application:
 * 1. User inputs datetime in their local timezone
 * 2. Convert to UTC for storage in backend
 * 3. Display back to users in their local timezone
 *
 * Uses date-fns-tz for robust timezone handling
 */

import { formatInTimeZone, toZonedTime, fromZonedTime } from 'date-fns-tz';
import { format, parseISO } from 'date-fns';

/**
 * Get the user's current timezone
 * Uses Intl.DateTimeFormat to detect browser timezone
 */
export function getUserTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/**
 * Convert a local datetime-local input value to UTC ISO string
 *
 * @param localDateTimeString - Value from datetime-local input (e.g., "2024-11-15T18:00")
 * @returns ISO 8601 UTC string (e.g., "2024-11-16T02:00:00.000Z")
 *
 * @example
 * // User in PST (UTC-8) selects 6pm Nov 15
 * localToUTC("2024-11-15T18:00") // "2024-11-16T02:00:00.000Z"
 */
export function localDateTimeToUTC(localDateTimeString: string): string {
  if (!localDateTimeString) {
    throw new Error('localDateTimeString is required');
  }

  // The datetime-local input gives us a string like "2024-11-15T18:00"
  // We need to treat this as the user's local time and convert to UTC
  const userTimezone = getUserTimezone();

  // Parse the local datetime string and treat it as being in the user's timezone
  const localDate = fromZonedTime(localDateTimeString, userTimezone);

  // Convert to UTC ISO string
  return localDate.toISOString();
}

/**
 * Convert a UTC ISO string to local datetime-local input value
 *
 * @param utcISOString - UTC ISO 8601 string from backend (e.g., "2024-11-16T02:00:00.000Z")
 * @returns datetime-local formatted string (e.g., "2024-11-15T18:00")
 *
 * @example
 * // Convert UTC to PST (UTC-8) for datetime-local input
 * utcToLocalDateTime("2024-11-16T02:00:00.000Z") // "2024-11-15T18:00"
 */
export function utcToLocalDateTime(utcISOString: string): string {
  if (!utcISOString) {
    return '';
  }

  const userTimezone = getUserTimezone();
  const date = parseISO(utcISOString);

  // Convert to user's local timezone and format for datetime-local input
  // Format: YYYY-MM-DDTHH:mm (no seconds)
  return formatInTimeZone(date, userTimezone, "yyyy-MM-dd'T'HH:mm");
}

/**
 * Format a UTC ISO string for display to the user in their local timezone
 *
 * @param utcISOString - UTC ISO 8601 string from backend
 * @param formatString - date-fns format string (default: "PPpp" for full date and time)
 * @returns Formatted date string in user's local timezone
 *
 * @example
 * formatUTCForDisplay("2024-11-16T02:00:00.000Z")
 * // In PST: "Nov 15, 2024, 6:00 PM"
 *
 * formatUTCForDisplay("2024-11-16T02:00:00.000Z", "MMM d, yyyy 'at' h:mm a")
 * // In PST: "Nov 15, 2024 at 6:00 PM"
 */
export function formatUTCForDisplay(
  utcISOString: string,
  formatString: string = 'PPpp' // Full date and time
): string {
  if (!utcISOString) {
    return '';
  }

  const userTimezone = getUserTimezone();
  const date = parseISO(utcISOString);

  return formatInTimeZone(date, userTimezone, formatString);
}

/**
 * Get the current datetime in the format expected by datetime-local input
 * Useful for setting default values
 *
 * @returns Current datetime formatted for datetime-local input
 *
 * @example
 * <DateTimeInput value={getCurrentLocalDateTime()} />
 */
export function getCurrentLocalDateTime(): string {
  const userTimezone = getUserTimezone();
  const now = new Date();

  return formatInTimeZone(now, userTimezone, "yyyy-MM-dd'T'HH:mm");
}

/**
 * Get a minimum datetime value for datetime-local input (e.g., "now + 1 hour")
 * Useful for validation
 *
 * @param minutesFromNow - How many minutes from now (default: 0)
 * @returns Formatted datetime for datetime-local input
 *
 * @example
 * <DateTimeInput min={getMinDateTime(60)} /> // At least 1 hour from now
 */
export function getMinDateTime(minutesFromNow: number = 0): string {
  const userTimezone = getUserTimezone();
  const now = new Date();
  const minDate = new Date(now.getTime() + minutesFromNow * 60 * 1000);

  return formatInTimeZone(minDate, userTimezone, "yyyy-MM-dd'T'HH:mm");
}

/**
 * Check if a UTC datetime is in the past
 *
 * @param utcISOString - UTC ISO 8601 string
 * @returns true if the datetime is in the past
 */
export function isInPast(utcISOString: string): boolean {
  if (!utcISOString) {
    return false;
  }

  const date = parseISO(utcISOString);
  return date < new Date();
}

/**
 * Check if a UTC datetime is in the future
 *
 * @param utcISOString - UTC ISO 8601 string
 * @returns true if the datetime is in the future
 */
export function isInFuture(utcISOString: string): boolean {
  if (!utcISOString) {
    return false;
  }

  const date = parseISO(utcISOString);
  return date > new Date();
}

/**
 * Get time remaining until a UTC datetime
 * Returns object with days, hours, minutes, seconds
 *
 * @param utcISOString - UTC ISO 8601 string
 * @returns Object with time components or null if in past
 *
 * @example
 * const remaining = getTimeRemaining("2024-11-16T02:00:00.000Z");
 * if (remaining) {
 *   console.log(`${remaining.days}d ${remaining.hours}h ${remaining.minutes}m`);
 * }
 */
export function getTimeRemaining(utcISOString: string): {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  total: number;
} | null {
  if (!utcISOString) {
    return null;
  }

  const deadline = parseISO(utcISOString);
  const now = new Date();
  const total = deadline.getTime() - now.getTime();

  if (total < 0) {
    return null;
  }

  return {
    total,
    days: Math.floor(total / (1000 * 60 * 60 * 24)),
    hours: Math.floor((total / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((total / 1000 / 60) % 60),
    seconds: Math.floor((total / 1000) % 60),
  };
}
