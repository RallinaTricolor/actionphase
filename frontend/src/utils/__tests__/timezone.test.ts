import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getUserTimezone,
  localDateTimeToUTC,
  utcToLocalDateTime,
  formatUTCForDisplay,
  getCurrentLocalDateTime,
  getMinDateTime,
  isInPast,
  isInFuture,
  getTimeRemaining,
} from '../timezone';

describe('timezone utilities', () => {
  // Store original timezone (unused but kept for reference)
  const _originalTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  beforeEach(() => {
    // Mock Date.now() to return a consistent timestamp for tests
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-11-15T12:00:00.000Z')); // Noon UTC
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('getUserTimezone', () => {
    it('should return the user timezone from browser', () => {
      const timezone = getUserTimezone();
      expect(timezone).toBeTruthy();
      expect(typeof timezone).toBe('string');
      // Should be a valid IANA timezone like 'America/Los_Angeles' or 'UTC'
      expect(timezone.length).toBeGreaterThan(0);
    });

    it('should return consistent timezone on multiple calls', () => {
      const tz1 = getUserTimezone();
      const tz2 = getUserTimezone();
      expect(tz1).toBe(tz2);
    });
  });

  describe('localDateTimeToUTC', () => {
    it('should convert local datetime string to UTC ISO string', () => {
      const localInput = '2024-11-15T18:00'; // 6pm local
      const result = localDateTimeToUTC(localInput);

      // Result should be valid ISO 8601 UTC string
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

      // Should parse successfully
      const parsedDate = new Date(result);
      expect(parsedDate.toString()).not.toBe('Invalid Date');
    });

    it('should throw error for empty string', () => {
      expect(() => localDateTimeToUTC('')).toThrow('localDateTimeString is required');
    });

    it('should throw error for undefined input', () => {
      expect(() => localDateTimeToUTC(undefined as unknown as string)).toThrow('localDateTimeString is required');
    });

    it('should handle midnight correctly', () => {
      const localInput = '2024-11-15T00:00';
      const result = localDateTimeToUTC(localInput);

      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it('should handle end of day correctly', () => {
      const localInput = '2024-11-15T23:59';
      const result = localDateTimeToUTC(localInput);

      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });
  });

  describe('utcToLocalDateTime', () => {
    it('should convert UTC ISO string to datetime-local format', () => {
      const utcInput = '2024-11-16T02:00:00.000Z';
      const result = utcToLocalDateTime(utcInput);

      // Should be in YYYY-MM-DDTHH:mm format (no seconds)
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);

      // Should NOT contain seconds or timezone
      expect(result).not.toContain('Z');
      expect(result.split(':').length).toBe(2); // Only hours and minutes
    });

    it('should return empty string for empty input', () => {
      expect(utcToLocalDateTime('')).toBe('');
    });

    it('should return empty string for undefined', () => {
      expect(utcToLocalDateTime(undefined as unknown as string)).toBe('');
    });

    it('should handle midnight UTC correctly', () => {
      const utcInput = '2024-11-15T00:00:00.000Z';
      const result = utcToLocalDateTime(utcInput);

      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    });

    it('should be inverse of localDateTimeToUTC', () => {
      const originalLocal = '2024-11-15T18:00';
      const utc = localDateTimeToUTC(originalLocal);
      const backToLocal = utcToLocalDateTime(utc);

      expect(backToLocal).toBe(originalLocal);
    });
  });

  describe('formatUTCForDisplay', () => {
    it('should format UTC string for display with default format', () => {
      const utcInput = '2024-11-15T18:00:00.000Z';
      const result = formatUTCForDisplay(utcInput);

      // Default format is 'PPpp' which includes date and time
      expect(result).toBeTruthy();
      expect(result.length).toBeGreaterThan(0);
    });

    it('should format with custom format string', () => {
      const utcInput = '2024-11-15T18:00:00.000Z';
      const result = formatUTCForDisplay(utcInput, "MMM d, yyyy 'at' h:mm a");

      // Should contain parts of the custom format
      expect(result).toContain('2024');
      expect(result).toContain('at');
    });

    it('should return empty string for empty input', () => {
      expect(formatUTCForDisplay('')).toBe('');
    });

    it('should handle different timezones', () => {
      const utcInput = '2024-11-15T00:00:00.000Z';
      const result = formatUTCForDisplay(utcInput);

      // Should format successfully regardless of user timezone
      expect(result).toBeTruthy();
    });
  });

  describe('getCurrentLocalDateTime', () => {
    it('should return current datetime in local format', () => {
      const result = getCurrentLocalDateTime();

      // Should be in YYYY-MM-DDTHH:mm format
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    });

    it('should return consistent value when called immediately', () => {
      const result1 = getCurrentLocalDateTime();
      const result2 = getCurrentLocalDateTime();

      expect(result1).toBe(result2);
    });

    it('should be valid input for datetime-local field', () => {
      const result = getCurrentLocalDateTime();

      // Should be parseable back to a date
      const date = new Date(result);
      expect(date.toString()).not.toBe('Invalid Date');
    });
  });

  describe('getMinDateTime', () => {
    it('should return current time with default (0 minutes)', () => {
      const result = getMinDateTime();
      const expected = getCurrentLocalDateTime();

      expect(result).toBe(expected);
    });

    it('should add specified minutes to current time', () => {
      const result = getMinDateTime(60); // 1 hour from now

      // Should be in correct format
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);

      // Convert both to timestamps to verify the difference
      const now = new Date();
      const future = new Date(result);
      const diffMinutes = Math.round((future.getTime() - now.getTime()) / (1000 * 60));

      // Should be approximately 60 minutes (allowing for small timing differences)
      expect(diffMinutes).toBeGreaterThanOrEqual(59);
      expect(diffMinutes).toBeLessThanOrEqual(61);
    });

    it('should handle large minute values', () => {
      const result = getMinDateTime(24 * 60); // 24 hours from now

      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    });

    it('should be valid input for datetime-local min attribute', () => {
      const result = getMinDateTime(30);

      // Should be parseable
      const date = new Date(result);
      expect(date.toString()).not.toBe('Invalid Date');
    });
  });

  describe('isInPast', () => {
    it('should return true for past dates', () => {
      const pastDate = '2024-11-15T00:00:00.000Z'; // Earlier than mocked "now"
      expect(isInPast(pastDate)).toBe(true);
    });

    it('should return false for future dates', () => {
      const futureDate = '2024-11-15T23:00:00.000Z'; // Later than mocked "now"
      expect(isInPast(futureDate)).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(isInPast('')).toBe(false);
    });

    it('should handle dates very close to now', () => {
      const nowUTC = new Date('2024-11-15T12:00:00.000Z').toISOString();
      const result = isInPast(nowUTC);

      // Could be true or false depending on millisecond timing
      expect(typeof result).toBe('boolean');
    });
  });

  describe('isInFuture', () => {
    it('should return true for future dates', () => {
      const futureDate = '2024-11-15T23:00:00.000Z'; // Later than mocked "now"
      expect(isInFuture(futureDate)).toBe(true);
    });

    it('should return false for past dates', () => {
      const pastDate = '2024-11-15T00:00:00.000Z'; // Earlier than mocked "now"
      expect(isInFuture(pastDate)).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(isInFuture('')).toBe(false);
    });

    it('should be inverse of isInPast for most dates', () => {
      const pastDate = '2024-11-14T00:00:00.000Z';
      const futureDate = '2024-11-16T00:00:00.000Z';

      expect(isInPast(pastDate)).toBe(true);
      expect(isInFuture(pastDate)).toBe(false);

      expect(isInPast(futureDate)).toBe(false);
      expect(isInFuture(futureDate)).toBe(true);
    });
  });

  describe('getTimeRemaining', () => {
    it('should return null for past dates', () => {
      const pastDate = '2024-11-15T00:00:00.000Z';
      expect(getTimeRemaining(pastDate)).toBeNull();
    });

    it('should return null for empty string', () => {
      expect(getTimeRemaining('')).toBeNull();
    });

    it('should calculate days, hours, minutes, seconds correctly', () => {
      // Mocked "now" is 2024-11-15T12:00:00.000Z
      // Set deadline to 1 day, 6 hours, 30 minutes, 45 seconds from now
      const futureDate = '2024-11-16T18:30:45.000Z';
      const result = getTimeRemaining(futureDate);

      expect(result).not.toBeNull();
      expect(result!.days).toBe(1);
      expect(result!.hours).toBe(6);
      expect(result!.minutes).toBe(30);
      expect(result!.seconds).toBe(45);
      expect(result!.total).toBeGreaterThan(0);
    });

    it('should handle less than a day correctly', () => {
      // 6 hours from now
      const futureDate = '2024-11-15T18:00:00.000Z';
      const result = getTimeRemaining(futureDate);

      expect(result).not.toBeNull();
      expect(result!.days).toBe(0);
      expect(result!.hours).toBe(6);
      expect(result!.minutes).toBe(0);
      expect(result!.seconds).toBe(0);
    });

    it('should handle multiple days correctly', () => {
      // 3 days, 12 hours from now
      const futureDate = '2024-11-19T00:00:00.000Z';
      const result = getTimeRemaining(futureDate);

      expect(result).not.toBeNull();
      expect(result!.days).toBe(3);
      expect(result!.hours).toBe(12);
    });

    it('should include total milliseconds', () => {
      const futureDate = '2024-11-15T13:00:00.000Z'; // 1 hour from now
      const result = getTimeRemaining(futureDate);

      expect(result).not.toBeNull();
      expect(result!.total).toBe(60 * 60 * 1000); // 1 hour in milliseconds
    });

    it('should handle very close deadlines', () => {
      // 30 seconds from now
      const futureDate = new Date(Date.now() + 30000).toISOString();
      const result = getTimeRemaining(futureDate);

      expect(result).not.toBeNull();
      expect(result!.days).toBe(0);
      expect(result!.hours).toBe(0);
      expect(result!.minutes).toBe(0);
      expect(result!.seconds).toBeGreaterThanOrEqual(29);
      expect(result!.seconds).toBeLessThanOrEqual(31);
    });
  });

  describe('round-trip conversions', () => {
    it('should preserve datetime through local -> UTC -> local conversion', () => {
      const original = '2024-12-25T14:30'; // Christmas 2:30 PM local

      const utc = localDateTimeToUTC(original);
      const backToLocal = utcToLocalDateTime(utc);

      expect(backToLocal).toBe(original);
    });

    it('should handle various dates through conversion cycle', () => {
      const testDates = [
        '2024-01-01T00:00', // New Year midnight
        '2024-06-15T12:00', // Mid-year noon
        '2024-12-31T23:59', // End of year
      ];

      testDates.forEach(original => {
        const utc = localDateTimeToUTC(original);
        const backToLocal = utcToLocalDateTime(utc);
        expect(backToLocal).toBe(original);
      });
    });
  });

  describe('edge cases', () => {
    it('should handle DST transitions gracefully', () => {
      // This test ensures functions work during DST changes
      // Specific behavior depends on timezone, but should not crash
      const springForward = '2024-03-10T02:30'; // DST spring forward in US
      const fallBack = '2024-11-03T01:30'; // DST fall back in US

      expect(() => localDateTimeToUTC(springForward)).not.toThrow();
      expect(() => localDateTimeToUTC(fallBack)).not.toThrow();
    });

    it('should handle leap year dates', () => {
      const leapDay = '2024-02-29T12:00'; // 2024 is a leap year

      const utc = localDateTimeToUTC(leapDay);
      const backToLocal = utcToLocalDateTime(utc);

      expect(backToLocal).toBe(leapDay);
    });

    it('should handle year boundaries', () => {
      const newYearEve = '2024-12-31T23:59';
      const newYearDay = '2025-01-01T00:00';

      const utc1 = localDateTimeToUTC(newYearEve);
      const utc2 = localDateTimeToUTC(newYearDay);

      expect(utc1).toBeTruthy();
      expect(utc2).toBeTruthy();

      const d1 = new Date(utc1);
      const d2 = new Date(utc2);

      // Depending on timezone, these might be in different years in UTC
      expect(d1.toString()).not.toBe('Invalid Date');
      expect(d2.toString()).not.toBe('Invalid Date');
    });
  });
});
