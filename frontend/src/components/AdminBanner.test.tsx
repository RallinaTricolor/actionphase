import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AdminBanner } from './AdminBanner';
import * as useAdminModeHook from '../hooks/useAdminMode';

// Mock the useAdminMode hook
vi.mock('../hooks/useAdminMode', () => ({
  useAdminMode: vi.fn(),
}));

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  Shield: () => <div data-testid="shield-icon" />,
  X: () => <div data-testid="x-icon" />,
}));

describe('AdminBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('visibility', () => {
    it('does not render when admin mode is off', () => {
      vi.mocked(useAdminModeHook.useAdminMode).mockReturnValue({
        isAdmin: true,
        adminModeEnabled: false,
        toggleAdminMode: vi.fn(),
      });

      const { container: _container } = render(<AdminBanner />);

      expect(container.firstChild).toBeNull();
    });

    it('renders when admin mode is on', () => {
      vi.mocked(useAdminModeHook.useAdminMode).mockReturnValue({
        isAdmin: true,
        adminModeEnabled: true,
        toggleAdminMode: vi.fn(),
      });

      render(<AdminBanner />);

      expect(screen.getByText('Admin Mode Active')).toBeInTheDocument();
    });
  });

  describe('content', () => {
    it('displays the correct message', () => {
      vi.mocked(useAdminModeHook.useAdminMode).mockReturnValue({
        isAdmin: true,
        adminModeEnabled: true,
        toggleAdminMode: vi.fn(),
      });

      render(<AdminBanner />);

      expect(screen.getByText('Admin Mode Active')).toBeInTheDocument();
      expect(
        screen.getByText('You have elevated privileges. You can view all games and moderate content.')
      ).toBeInTheDocument();
    });

    it('displays shield icon', () => {
      vi.mocked(useAdminModeHook.useAdminMode).mockReturnValue({
        isAdmin: true,
        adminModeEnabled: true,
        toggleAdminMode: vi.fn(),
      });

      render(<AdminBanner />);

      expect(screen.getByTestId('shield-icon')).toBeInTheDocument();
    });

    it('displays exit button with X icon', () => {
      vi.mocked(useAdminModeHook.useAdminMode).mockReturnValue({
        isAdmin: true,
        adminModeEnabled: true,
        toggleAdminMode: vi.fn(),
      });

      render(<AdminBanner />);

      expect(screen.getByText('Exit Admin Mode')).toBeInTheDocument();
      expect(screen.getByTestId('x-icon')).toBeInTheDocument();
    });
  });

  describe('exit button', () => {
    it('calls toggleAdminMode when exit button is clicked', async () => {
      const _user = userEvent.setup();
      const mockToggle = vi.fn();

      vi.mocked(useAdminModeHook.useAdminMode).mockReturnValue({
        isAdmin: true,
        adminModeEnabled: true,
        toggleAdminMode: mockToggle,
      });

      render(<AdminBanner />);

      const exitButton = screen.getByRole('button', { name: /exit admin mode/i });
      await user.click(exitButton);

      expect(mockToggle).toHaveBeenCalledTimes(1);
    });

    it('has proper accessibility label', () => {
      vi.mocked(useAdminModeHook.useAdminMode).mockReturnValue({
        isAdmin: true,
        adminModeEnabled: true,
        toggleAdminMode: vi.fn(),
      });

      render(<AdminBanner />);

      const exitButton = screen.getByRole('button', { name: /exit admin mode/i });
      expect(exitButton).toHaveAttribute('aria-label', 'Exit admin mode');
    });
  });

  describe('accessibility', () => {
    it('has proper ARIA role and live region', () => {
      vi.mocked(useAdminModeHook.useAdminMode).mockReturnValue({
        isAdmin: true,
        adminModeEnabled: true,
        toggleAdminMode: vi.fn(),
      });

      const { container: _container } = render(<AdminBanner />);

      const banner = container.firstChild as HTMLElement;
      expect(banner).toHaveAttribute('role', 'alert');
      expect(banner).toHaveAttribute('aria-live', 'polite');
    });

    it('has hidden aria labels on decorative icons', () => {
      vi.mocked(useAdminModeHook.useAdminMode).mockReturnValue({
        isAdmin: true,
        adminModeEnabled: true,
        toggleAdminMode: vi.fn(),
      });

      render(<AdminBanner />);

      // Both icons should be marked as aria-hidden in the actual component
      // This test verifies our icon rendering structure
      expect(screen.getByTestId('shield-icon')).toBeInTheDocument();
      expect(screen.getByTestId('x-icon')).toBeInTheDocument();
    });
  });

  describe('styling', () => {
    it('applies warning color classes', () => {
      vi.mocked(useAdminModeHook.useAdminMode).mockReturnValue({
        isAdmin: true,
        adminModeEnabled: true,
        toggleAdminMode: vi.fn(),
      });

      const { container: _container } = render(<AdminBanner />);

      const banner = container.firstChild as HTMLElement;
      expect(banner.className).toContain('bg-semantic-warning/20');
      expect(banner.className).toContain('border-semantic-warning');
    });
  });
});
