import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, render } from '@testing-library/react';
import { DeadlineTimer } from './DeadlineTimer';

describe('DeadlineTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('Valid deadlines', () => {
    it('should render future deadline (>24h) with primary variant (blue)', () => {
      const futureDate = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours from now
      const isoDate = futureDate.toISOString();

      render(<DeadlineTimer deadline={isoDate} />);

      // Should show time remaining
      expect(screen.getByText(/in \d+ (hour|day)s?/i)).toBeInTheDocument();

      // Should have primary variant (blue) since >24h away
      const badge = screen.getByText(/in \d+ (hour|day)s?/i).closest('span');
      expect(badge).toHaveClass('bg-semantic-info-subtle');
    });

    it('should render urgent deadline (<2h) with danger variant (red)', () => {
      const urgentDate = new Date(Date.now() + 1 * 60 * 60 * 1000); // 1 hour from now
      const isoDate = urgentDate.toISOString();

      const { container } = render(<DeadlineTimer deadline={isoDate} />);

      // Should show time remaining
      expect(container.textContent).toMatch(/⏱️\s+in (about )?1 hour/i);

      // Should have danger variant (red) since <2h away
      const badge = container.querySelector('span');
      expect(badge).toHaveClass('bg-semantic-danger-subtle');
    });

    it('should render soon deadline (<24h but >2h) with warning variant (yellow)', () => {
      const soonDate = new Date(Date.now() + 12 * 60 * 60 * 1000); // 12 hours from now
      const isoDate = soonDate.toISOString();

      const { container } = render(<DeadlineTimer deadline={isoDate} />);

      // Should show time remaining (use textContent to handle emoji)
      expect(container.textContent).toMatch(/⏱️\s+in (about )?\d+ hours?/i);

      // Should have warning variant (yellow) since <24h but >2h away
      const badge = container.querySelector('span');
      expect(badge).toHaveClass('bg-semantic-warning-subtle');
    });

    it('should render expired deadline with danger variant', () => {
      const pastDate = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 hours ago
      const isoDate = pastDate.toISOString();

      render(<DeadlineTimer deadline={isoDate} />);

      // Should show "ago" text
      expect(screen.getByText(/\d+ hours? ago/i)).toBeInTheDocument();

      // Should have danger variant (red) since expired
      const badge = screen.getByText(/\d+ hours? ago/i).closest('span');
      expect(badge).toHaveClass('bg-semantic-danger-subtle');
    });

    it('should display correct emoji for future deadline', () => {
      const futureDate = new Date(Date.now() + 48 * 60 * 60 * 1000);
      const isoDate = futureDate.toISOString();

      const { container } = render(<DeadlineTimer deadline={isoDate} />);

      // Should show timer emoji
      expect(container.textContent).toContain('⏱️');
      expect(container.textContent).not.toContain('⏰');
    });

    it('should display correct emoji for expired deadline', () => {
      const pastDate = new Date(Date.now() - 2 * 60 * 60 * 1000);
      const isoDate = pastDate.toISOString();

      const { container } = render(<DeadlineTimer deadline={isoDate} />);

      // Should show alarm emoji
      expect(container.textContent).toContain('⏰');
      expect(container.textContent).not.toContain('⏱️');
    });
  });

  describe('Invalid deadlines', () => {
    it('should handle invalid date string gracefully', () => {
      const invalidDate = 'not-a-date';

      const { container } = render(<DeadlineTimer deadline={invalidDate} />);

      expect(container.textContent).toContain('Invalid date');

      // Should have neutral variant
      const badge = container.querySelector('span');
      expect(badge).toHaveClass('surface-raised');
    });

    it('should handle empty string gracefully', () => {
      const { container } = render(<DeadlineTimer deadline="" />);

      expect(container.textContent).toContain('Invalid date');
    });

    it('should handle malformed ISO string gracefully', () => {
      const malformedDate = '2024-13-45T99:99:99Z'; // Invalid month/day/time

      const { container } = render(<DeadlineTimer deadline={malformedDate} />);

      expect(container.textContent).toContain('Invalid date');
    });
  });

  describe('Auto-updating behavior', () => {
    it('should set up interval for auto-updating', () => {
      const futureDate = new Date(Date.now() + 90 * 60 * 1000); // 90 minutes from now
      const isoDate = futureDate.toISOString();

      const setIntervalSpy = vi.spyOn(global, 'setInterval');

      render(<DeadlineTimer deadline={isoDate} />);

      // Should set up an interval
      expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 60000);
    });

    it('should clean up interval on unmount', () => {
      const futureDate = new Date(Date.now() + 48 * 60 * 60 * 1000);
      const isoDate = futureDate.toISOString();

      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');

      const { unmount } = render(<DeadlineTimer deadline={isoDate} />);

      unmount();

      expect(clearIntervalSpy).toHaveBeenCalled();
    });
  });

  describe('Custom className', () => {
    it('should apply custom className', () => {
      const futureDate = new Date(Date.now() + 48 * 60 * 60 * 1000);
      const isoDate = futureDate.toISOString();

      const { container } = render(
        <DeadlineTimer deadline={isoDate} className="custom-class" />
      );

      const badge = container.querySelector('.custom-class');
      expect(badge).toBeInTheDocument();
    });

    it('should work without className prop', () => {
      const futureDate = new Date(Date.now() + 48 * 60 * 60 * 1000);
      const isoDate = futureDate.toISOString();

      render(<DeadlineTimer deadline={isoDate} />);

      expect(screen.getByText(/in \d+ (hour|day)s?/i)).toBeInTheDocument();
    });
  });

  describe('Edge cases', () => {
    it('should handle deadline exactly now', () => {
      const now = new Date();
      const isoDate = now.toISOString();

      render(<DeadlineTimer deadline={isoDate} />);

      // Should show as expired (isPast returns true for current time)
      const text = screen.getByText(/ago|now/i);
      expect(text).toBeInTheDocument();
    });

    it('should handle very far future deadline', () => {
      const farFuture = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 year from now
      const isoDate = farFuture.toISOString();

      render(<DeadlineTimer deadline={isoDate} />);

      expect(screen.getByText(/in (about )?(\d+ months?|\d+ year)/i)).toBeInTheDocument();

      // Should have primary variant (blue) since >24h
      const badge = screen.getByText(/in (about )?(\d+ months?|\d+ year)/i).closest('span');
      expect(badge).toHaveClass('bg-semantic-info-subtle');
    });

    it('should handle very old deadline', () => {
      const longAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000); // 1 year ago
      const isoDate = longAgo.toISOString();

      render(<DeadlineTimer deadline={isoDate} />);

      expect(screen.getByText(/(\d+ months?|\d+ year) ago/i)).toBeInTheDocument();

      // Should have danger variant
      const badge = screen.getByText(/(\d+ months?|\d+ year) ago/i).closest('span');
      expect(badge).toHaveClass('bg-semantic-danger-subtle');
    });

    it('should transition from warning to danger when deadline passes', () => {
      // Start with deadline 12 hours in future
      const initialDate = new Date(Date.now() + 12 * 60 * 60 * 1000);
      const { rerender, container } = render(<DeadlineTimer deadline={initialDate.toISOString()} />);

      // Should be warning
      let badge = container.querySelector('span');
      expect(badge).toHaveClass('bg-semantic-warning-subtle');

      // Update to past deadline
      const pastDate = new Date(Date.now() - 1 * 60 * 60 * 1000);
      rerender(<DeadlineTimer deadline={pastDate.toISOString()} />);

      // Should now be danger
      badge = container.querySelector('span');
      expect(badge).toHaveClass('bg-semantic-danger-subtle');
    });

    it('should transition from success to warning when deadline approaches', () => {
      // Start with deadline 48 hours in future
      const initialDate = new Date(Date.now() + 48 * 60 * 60 * 1000);
      const { rerender, container } = render(<DeadlineTimer deadline={initialDate.toISOString()} />);

      // Should be primary (blue)
      let badge = container.querySelector('span');
      expect(badge).toHaveClass('bg-semantic-info-subtle');

      // Update to 12 hours in future
      const soonDate = new Date(Date.now() + 12 * 60 * 60 * 1000);
      rerender(<DeadlineTimer deadline={soonDate.toISOString()} />);

      // Should now be warning (yellow)
      badge = container.querySelector('span');
      expect(badge).toHaveClass('bg-semantic-warning-subtle');
    });
  });

  describe('Accessibility', () => {
    it('should render as a badge component', () => {
      const futureDate = new Date(Date.now() + 48 * 60 * 60 * 1000);
      const isoDate = futureDate.toISOString();

      render(<DeadlineTimer deadline={isoDate} />);

      // Badge should be a span
      const badge = screen.getByText(/in \d+ (hour|day)s?/i).closest('span');
      expect(badge?.tagName).toBe('SPAN');
    });

    it('should have readable text for screen readers', () => {
      const futureDate = new Date(Date.now() + 48 * 60 * 60 * 1000);
      const isoDate = futureDate.toISOString();

      render(<DeadlineTimer deadline={isoDate} />);

      // Text should be descriptive
      const text = screen.getByText(/in \d+ (hour|day)s?/i).textContent;
      expect(text).toMatch(/⏱️\s+in \d+ (hour|day)s?/i);
    });
  });
});
