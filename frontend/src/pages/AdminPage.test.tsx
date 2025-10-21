import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AdminPage } from './AdminPage';
import { apiClient } from '../lib/api';

// Mock the API client
vi.mock('../lib/api', () => ({
  apiClient: {
    admin: {
      listAdmins: vi.fn(),
      listBannedUsers: vi.fn(),
      banUser: vi.fn(),
      unbanUser: vi.fn(),
    },
  },
}));

// Mock window.confirm and window.alert
const mockConfirm = vi.fn();
const mockAlert = vi.fn();
global.confirm = mockConfirm;
global.alert = mockAlert;

describe('AdminPage', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    // Create a new QueryClient for each test to ensure isolation
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    // Reset all mocks
    vi.clearAllMocks();
    mockConfirm.mockReturnValue(true);
  });

  const renderAdminPage = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <AdminPage />
      </QueryClientProvider>
    );
  };

  describe('Banned Users Tab', () => {
    it('shows loading state initially', () => {
      vi.mocked(apiClient.admin.listBannedUsers).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      renderAdminPage();

      expect(screen.getByText(/loading banned users/i)).toBeInTheDocument();
    });

    it('displays empty state when no banned users exist', async () => {
      vi.mocked(apiClient.admin.listBannedUsers).mockResolvedValue({
        data: [],
      } as any);

      renderAdminPage();

      await waitFor(() => {
        expect(screen.getByText(/no banned users/i)).toBeInTheDocument();
      });
    });

    it('displays list of banned users', async () => {
      const bannedUsers = [
        {
          id: 1,
          username: 'banneduser1',
          email: 'banned1@example.com',
          banned_at: '2025-10-21T12:00:00Z',
          banned_by_user_id: 2,
          banned_by_username: 'admin',
          created_at: '2025-01-01T00:00:00Z',
        },
        {
          id: 2,
          username: 'banneduser2',
          email: 'banned2@example.com',
          banned_at: '2025-10-21T13:00:00Z',
          banned_by_user_id: 2,
          banned_by_username: 'admin',
          created_at: '2025-01-01T00:00:00Z',
        },
      ];

      vi.mocked(apiClient.admin.listBannedUsers).mockResolvedValue({
        data: bannedUsers,
      } as any);

      renderAdminPage();

      await waitFor(() => {
        expect(screen.getByText('banneduser1')).toBeInTheDocument();
        expect(screen.getByText('banneduser2')).toBeInTheDocument();
        expect(screen.getByText('banned1@example.com')).toBeInTheDocument();
        expect(screen.getByText('banned2@example.com')).toBeInTheDocument();
      });

      // Check for BANNED badges
      const badges = screen.getAllByText('BANNED');
      expect(badges).toHaveLength(2);

      // Check for "Banned by" information (text is split across elements)
      const bannedByTexts = screen.getAllByText(/^Banned by:/i);
      expect(bannedByTexts).toHaveLength(2);
    });

    it('displays error state when API fails', async () => {
      vi.mocked(apiClient.admin.listBannedUsers).mockRejectedValue(
        new Error('API Error')
      );

      renderAdminPage();

      await waitFor(() => {
        expect(
          screen.getByText(/error loading banned users/i)
        ).toBeInTheDocument();
      });
    });

    it('unbans a user when unban button is clicked and confirmed', async () => {
      const user = {
        id: 1,
        username: 'banneduser',
        email: 'banned@example.com',
        banned_at: '2025-10-21T12:00:00Z',
        banned_by_user_id: 2,
        banned_by_username: 'admin',
        created_at: '2025-01-01T00:00:00Z',
      };

      vi.mocked(apiClient.admin.listBannedUsers).mockResolvedValue({
        data: [user],
      } as any);

      vi.mocked(apiClient.admin.unbanUser).mockResolvedValue({} as any);

      renderAdminPage();

      await waitFor(() => {
        expect(screen.getByText('banneduser')).toBeInTheDocument();
      });

      const unbanButton = screen.getByRole('button', { name: /unban user/i });
      await userEvent.click(unbanButton);

      // Verify confirmation dialog was shown
      expect(mockConfirm).toHaveBeenCalledWith(
        'Are you sure you want to unban user "banneduser"?'
      );

      // Verify API was called
      await waitFor(() => {
        expect(apiClient.admin.unbanUser).toHaveBeenCalledWith(1);
      });

      // Verify success alert
      expect(mockAlert).toHaveBeenCalledWith('User unbanned successfully');
    });

    it('does not unban user when confirmation is cancelled', async () => {
      mockConfirm.mockReturnValue(false);

      const user = {
        id: 1,
        username: 'banneduser',
        email: 'banned@example.com',
        banned_at: '2025-10-21T12:00:00Z',
        banned_by_user_id: 2,
        banned_by_username: 'admin',
        created_at: '2025-01-01T00:00:00Z',
      };

      vi.mocked(apiClient.admin.listBannedUsers).mockResolvedValue({
        data: [user],
      } as any);

      renderAdminPage();

      await waitFor(() => {
        expect(screen.getByText('banneduser')).toBeInTheDocument();
      });

      const unbanButton = screen.getByRole('button', { name: /unban user/i });
      await userEvent.click(unbanButton);

      // Verify API was not called
      expect(apiClient.admin.unbanUser).not.toHaveBeenCalled();
    });

    it('shows error alert when unban fails', async () => {
      const user = {
        id: 1,
        username: 'banneduser',
        email: 'banned@example.com',
        banned_at: '2025-10-21T12:00:00Z',
        banned_by_user_id: 2,
        banned_by_username: 'admin',
        created_at: '2025-01-01T00:00:00Z',
      };

      vi.mocked(apiClient.admin.listBannedUsers).mockResolvedValue({
        data: [user],
      } as any);

      vi.mocked(apiClient.admin.unbanUser).mockRejectedValue(
        new Error('API Error')
      );

      renderAdminPage();

      await waitFor(() => {
        expect(screen.getByText('banneduser')).toBeInTheDocument();
      });

      const unbanButton = screen.getByRole('button', { name: /unban user/i });
      await userEvent.click(unbanButton);

      await waitFor(() => {
        expect(mockAlert).toHaveBeenCalledWith(
          expect.stringContaining('Failed to unban user')
        );
      });
    });
  });

  describe('Admins Tab', () => {
    it('switches to admins tab when clicked', async () => {
      vi.mocked(apiClient.admin.listBannedUsers).mockResolvedValue({
        data: [],
      } as any);
      vi.mocked(apiClient.admin.listAdmins).mockResolvedValue({
        data: [],
      } as any);

      renderAdminPage();

      const adminsTab = screen.getByRole('button', { name: /^admins$/i });
      await userEvent.click(adminsTab);

      await waitFor(() => {
        expect(screen.getByText(/administrator users/i)).toBeInTheDocument();
      });
    });

    it('displays list of admin users', async () => {
      const admins = [
        {
          id: 1,
          username: 'admin1',
          email: 'admin1@example.com',
          createdAt: '2025-01-01T00:00:00Z',
        },
        {
          id: 2,
          username: 'admin2',
          email: 'admin2@example.com',
          createdAt: '2025-01-02T00:00:00Z',
        },
      ];

      vi.mocked(apiClient.admin.listBannedUsers).mockResolvedValue({
        data: [],
      } as any);
      vi.mocked(apiClient.admin.listAdmins).mockResolvedValue({
        data: admins,
      } as any);

      renderAdminPage();

      const adminsTab = screen.getByRole('button', { name: /^admins$/i });
      await userEvent.click(adminsTab);

      await waitFor(() => {
        expect(screen.getByText('admin1')).toBeInTheDocument();
        expect(screen.getByText('admin2')).toBeInTheDocument();
        expect(screen.getByText('admin1@example.com')).toBeInTheDocument();
        expect(screen.getByText('admin2@example.com')).toBeInTheDocument();
      });

      // Check for ADMIN badges
      const badges = screen.getAllByText('ADMIN');
      expect(badges.length).toBeGreaterThanOrEqual(2);
    });

    it('displays empty state when no admins exist', async () => {
      vi.mocked(apiClient.admin.listBannedUsers).mockResolvedValue({
        data: [],
      } as any);
      vi.mocked(apiClient.admin.listAdmins).mockResolvedValue({
        data: [],
      } as any);

      renderAdminPage();

      const adminsTab = screen.getByRole('button', { name: /^admins$/i });
      await userEvent.click(adminsTab);

      await waitFor(() => {
        expect(screen.getByText(/no administrators found/i)).toBeInTheDocument();
      });
    });

    it('displays error state when API fails', async () => {
      vi.mocked(apiClient.admin.listBannedUsers).mockResolvedValue({
        data: [],
      } as any);
      vi.mocked(apiClient.admin.listAdmins).mockRejectedValue(
        new Error('API Error')
      );

      renderAdminPage();

      const adminsTab = screen.getByRole('button', { name: /^admins$/i });
      await userEvent.click(adminsTab);

      await waitFor(() => {
        expect(
          screen.getByText(/error loading administrators/i)
        ).toBeInTheDocument();
      });
    });
  });

  describe('Tab Navigation', () => {
    it('shows Banned Users tab by default', async () => {
      vi.mocked(apiClient.admin.listBannedUsers).mockResolvedValue({
        data: [],
      } as any);

      renderAdminPage();

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /banned users/i })).toBeInTheDocument();
      });
    });

    it('switches between tabs correctly', async () => {
      vi.mocked(apiClient.admin.listBannedUsers).mockResolvedValue({
        data: [],
      } as any);
      vi.mocked(apiClient.admin.listAdmins).mockResolvedValue({
        data: [],
      } as any);

      renderAdminPage();

      // Start on Banned Users tab
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /banned users/i })).toBeInTheDocument();
      });

      // Switch to Admins tab
      const adminsTab = screen.getByRole('button', { name: /^admins$/i });
      await userEvent.click(adminsTab);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /administrator users/i })).toBeInTheDocument();
      });

      // Switch back to Banned Users tab
      const bannedUsersTab = screen.getByRole('button', { name: /banned users/i });
      await userEvent.click(bannedUsersTab);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /^banned users$/i })).toBeInTheDocument();
      });
    });
  });
});
