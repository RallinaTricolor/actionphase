import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AdminModeToggle } from './AdminModeToggle';
import * as useAdminModeHook from '../hooks/useAdminMode';

// Mock the useAdminMode hook
vi.mock('../hooks/useAdminMode', () => ({
  useAdminMode: vi.fn(),
}));

describe('AdminModeToggle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('visibility', () => {
    it('does not render for non-admin users', () => {
      vi.mocked(useAdminModeHook.useAdminMode).mockReturnValue({
        isAdmin: false,
        adminModeEnabled: false,
        toggleAdminMode: vi.fn(),
      });

      const { container } = render(<AdminModeToggle />);

      expect(container.firstChild).toBeNull();
    });

    it('renders for admin users', () => {
      vi.mocked(useAdminModeHook.useAdminMode).mockReturnValue({
        isAdmin: true,
        adminModeEnabled: false,
        toggleAdminMode: vi.fn(),
      });

      render(<AdminModeToggle />);

      expect(screen.getByText('Admin Mode')).toBeInTheDocument();
      expect(screen.getByRole('switch')).toBeInTheDocument();
    });
  });

  describe('toggle switch', () => {
    it('shows unchecked state when admin mode is off', () => {
      vi.mocked(useAdminModeHook.useAdminMode).mockReturnValue({
        isAdmin: true,
        adminModeEnabled: false,
        toggleAdminMode: vi.fn(),
      });

      render(<AdminModeToggle />);

      const toggle = screen.getByRole('switch');
      expect(toggle).toHaveAttribute('aria-checked', 'false');
      expect(toggle).toHaveAttribute('aria-label', 'Enable admin mode');
    });

    it('shows checked state when admin mode is on', () => {
      vi.mocked(useAdminModeHook.useAdminMode).mockReturnValue({
        isAdmin: true,
        adminModeEnabled: true,
        toggleAdminMode: vi.fn(),
      });

      render(<AdminModeToggle />);

      const toggle = screen.getByRole('switch');
      expect(toggle).toHaveAttribute('aria-checked', 'true');
      expect(toggle).toHaveAttribute('aria-label', 'Disable admin mode');
    });

    it('calls toggleAdminMode when clicked', async () => {
      const user = userEvent.setup();
      const mockToggle = vi.fn();

      vi.mocked(useAdminModeHook.useAdminMode).mockReturnValue({
        isAdmin: true,
        adminModeEnabled: false,
        toggleAdminMode: mockToggle,
      });

      render(<AdminModeToggle />);

      const toggle = screen.getByRole('switch');
      await user.click(toggle);

      expect(mockToggle).toHaveBeenCalledTimes(1);
    });
  });

  describe('active indicator', () => {
    it('does not show ACTIVE badge when admin mode is off', () => {
      vi.mocked(useAdminModeHook.useAdminMode).mockReturnValue({
        isAdmin: true,
        adminModeEnabled: false,
        toggleAdminMode: vi.fn(),
      });

      render(<AdminModeToggle />);

      expect(screen.queryByText('ACTIVE')).not.toBeInTheDocument();
    });

    it('shows ACTIVE badge when admin mode is on', () => {
      vi.mocked(useAdminModeHook.useAdminMode).mockReturnValue({
        isAdmin: true,
        adminModeEnabled: true,
        toggleAdminMode: vi.fn(),
      });

      render(<AdminModeToggle />);

      expect(screen.getByText('ACTIVE')).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('has proper ARIA attributes', () => {
      vi.mocked(useAdminModeHook.useAdminMode).mockReturnValue({
        isAdmin: true,
        adminModeEnabled: false,
        toggleAdminMode: vi.fn(),
      });

      render(<AdminModeToggle />);

      const toggle = screen.getByRole('switch');
      expect(toggle).toHaveAttribute('id', 'admin-mode-toggle');
      expect(toggle).toHaveAttribute('aria-checked', 'false');
      expect(toggle).toHaveAttribute('aria-label', 'Enable admin mode');

      const label = screen.getByText('Admin Mode');
      expect(label).toHaveAttribute('for', 'admin-mode-toggle');
    });

    it('updates ARIA label when admin mode changes', () => {
      vi.mocked(useAdminModeHook.useAdminMode).mockReturnValue({
        isAdmin: true,
        adminModeEnabled: true,
        toggleAdminMode: vi.fn(),
      });

      render(<AdminModeToggle />);

      const toggle = screen.getByRole('switch');
      expect(toggle).toHaveAttribute('aria-label', 'Disable admin mode');
      expect(toggle).toHaveAttribute('aria-checked', 'true');
    });
  });
});
