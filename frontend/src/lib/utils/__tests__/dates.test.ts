import { describe, it, expect, vi, afterEach } from 'vitest';
import { convertToISO8601, formatDateTimeLocal, formatRelativeTime } from '../dates';
import { localDateTimeToUTC } from '../../../utils/timezone';

/**
 * These guard the wire format of every date the frontend sends.
 *
 * The regression they exist for: game create/update once sent dates as
 * "November 10, 2025 12:00 AM" instead of ISO 8601, which the backend rejects.
 * That was previously caught only in src/lib/__tests__/api.games.test.ts, which
 * had been excluded from the vitest run since 2025-10-17 and so caught nothing
 * for eleven months. Testing convertToISO8601 directly is both cheaper and
 * broader: CreateGameForm and EditGameModal both route their dates through it
 * via useGameForm's buildApiPayload, so one test covers every caller.
 *
 * Timezone MATH is not retested here -- utils/__tests__/timezone.test.ts owns
 * localDateTimeToUTC and utcToLocalDateTime. What is pinned here is the
 * delegating layer: the output FORMAT, and the empty-input guard that only
 * exists in this module.
 */
describe('dates utilities', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  describe('convertToISO8601', () => {
    // THE REGRESSION GUARD. A datetime-local value must leave as ISO 8601, not
    // as a human-readable string. Asserted by shape rather than by a literal,
    // so the test does not silently encode the runner's timezone.
    it('emits ISO 8601 UTC, never a human-readable date', () => {
      const result = convertToISO8601('2025-11-10T14:30');

      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      // The shape the bug produced, spelled out so a regression names itself.
      expect(result).not.toMatch(/January|February|March|April|May|June|July|August|September|October|November|December/);
      expect(result).not.toMatch(/\s/);
      expect(result).not.toMatch(/[AP]M/i);
    });

    it('preserves the instant, so a round-trip returns the input', () => {
      const local = '2025-11-10T14:30';
      expect(formatDateTimeLocal(convertToISO8601(local))).toBe(local);
    });

    // Not cosmetic: localDateTimeToUTC THROWS on an empty string. This guard is
    // the only reason an optional, unfilled date field does not blow up the
    // whole payload -- buildApiPayload relies on `convertToISO8601(x) || undefined`.
    it('returns empty string for falsy input, where the underlying util throws', () => {
      expect(convertToISO8601('')).toBe('');
      expect(convertToISO8601(undefined)).toBe('');

      expect(() => localDateTimeToUTC('')).toThrow();
    });

    it('handles midnight, which is falsy-looking but a real time', () => {
      const result = convertToISO8601('2025-11-10T00:00');
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      expect(result).not.toBe('');
    });
  });

  describe('formatDateTimeLocal', () => {
    it('renders YYYY-MM-DDTHH:mm for a datetime-local input, with no seconds', () => {
      expect(formatDateTimeLocal('2025-11-10T22:30:00.000Z')).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/
      );
    });

    it('accepts a Date as well as a string', () => {
      const iso = '2025-11-10T22:30:00.000Z';
      expect(formatDateTimeLocal(new Date(iso))).toBe(formatDateTimeLocal(iso));
    });
  });

  describe('formatRelativeTime', () => {
    it('describes recent and older timestamps by magnitude', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-11-10T12:00:00.000Z'));

      expect(formatRelativeTime('2025-11-10T11:59:30.000Z')).toBe('Just now');
      expect(formatRelativeTime('2025-11-10T11:45:00.000Z')).toBe('15m ago');
      expect(formatRelativeTime('2025-11-10T09:00:00.000Z')).toBe('3h ago');
      expect(formatRelativeTime('2025-11-08T12:00:00.000Z')).toBe('2d ago');
    });
  });
});
