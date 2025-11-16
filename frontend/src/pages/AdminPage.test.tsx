import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { AxiosResponse } from 'axios';
import { AdminPage } from './AdminPage';
import { apiClient } from '../lib/api';
import { ToastProvider } from '../contexts/ToastContext';
import { AdminModeProvider } from '../contexts/AdminModeContext';

// Mock the API client
vi.mock('../lib/api', () => ({
  apiClient: {
    admin: {
      listAdmins: vi.fn(),
      listBannedUsers: vi.fn(),
      banUser: vi.fn(),
      unbanUser: vi.fn(),
      revokeAdminStatus: vi.fn(),
      grantAdminStatus: vi.fn(),
      getUserByUsername: vi.fn(),
    },
  },
}));

// Mock the AuthContext
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    currentUser: { id: 1, username: 'testadmin', email: 'test@example.com' },
    isAuthenticated: true,
    isLoading: false,
    isCheckingAuth: false,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    error: null,
  }),
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
        <AdminModeProvider>
          <ToastProvider>
            <AdminPage />
          </ToastProvider>
        </AdminModeProvider>
      </QueryClientProvider>
    );
  };

  describe('Banned Users Tab', () => {
    it('shows loading state initially', async () => {
      const _user = userEvent.setup();
      vi.mocked(apiClient.admin.listBannedUsers).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      renderAdminPage();

      // Click on Banned Users tab
      await user.click(screen.getByRole('button', { name: /banned users/i }));

      expect(screen.getByText(/loading banned users/i)).toBeInTheDocument();
    });

    it('displays empty state when no banned users exist', async () => {
      const _user = userEvent.setup();
      vi.mocked(apiClient.admin.listBannedUsers).mockResolvedValue({
        data: [],
      } as Partial<AxiosResponse<unknown[]>>);

      renderAdminPage();

      // Click on Banned Users tab
      await user.click(screen.getByRole('button', { name: /banned users/i }));

      await waitFor(() => {
        expect(screen.getByText(/no banned users/i)).toBeInTheDocument();
      });
    });

    it('displays list of banned users', async () => {
      const _user = userEvent.setup();
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
      } as Partial<AxiosResponse<unknown[]>>);

      renderAdminPage();

      // Click on Banned Users tab
      await user.click(screen.getByRole('button', { name: /banned users/i }));

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
      const _user = userEvent.setup();
      vi.mocked(apiClient.admin.listBannedUsers).mockRejectedValue(
        new Error('API Error')
      );

      renderAdminPage();

      // Click on Banned Users tab
      await user.click(screen.getByRole('button', { name: /banned users/i }));

      await waitFor(() => {
        expect(
          screen.getByText(/error loading banned users/i)
        ).toBeInTheDocument();
      });
    });

    it('unbans a user when unban button is clicked and confirmed', async () => {
      const userActions = userEvent.setup();
      const bannedUser = {
        id: 1,
        username: 'banneduser',
        email: 'banned@example.com',
        banned_at: '2025-10-21T12:00:00Z',
        banned_by_user_id: 2,
        banned_by_username: 'admin',
        created_at: '2025-01-01T00:00:00Z',
      };

      vi.mocked(apiClient.admin.listBannedUsers).mockResolvedValue({
        data: [bannedUser],
      } as Partial<AxiosResponse<unknown[]>>);

      vi.mocked(apiClient.admin.unbanUser).mockResolvedValue({} as Partial<AxiosResponse<unknown>>);

      renderAdminPage();

      // Click on Banned Users tab
      await userActions.click(screen.getByRole('button', { name: /banned users/i }));

      await waitFor(() => {
        expect(screen.getByText('banneduser')).toBeInTheDocument();
      });

      const unbanButton = screen.getByRole('button', { name: /unban user/i });
      await userActions.click(unbanButton);

      // Verify confirmation dialog was shown
      expect(mockConfirm).toHaveBeenCalledWith(
        'Are you sure you want to unban user "banneduser"?'
      );

      // Verify API was called
      await waitFor(() => {
        expect(apiClient.admin.unbanUser).toHaveBeenCalledWith(1);
      });

      // Success is shown via toast, not alert
      await waitFor(() => {
        expect(screen.getByText('User unbanned successfully')).toBeInTheDocument();
      });
    });

    it('does not unban user when confirmation is cancelled', async () => {
      const userActions = userEvent.setup();
      mockConfirm.mockReturnValue(false);

      const bannedUser = {
        id: 1,
        username: 'banneduser',
        email: 'banned@example.com',
        banned_at: '2025-10-21T12:00:00Z',
        banned_by_user_id: 2,
        banned_by_username: 'admin',
        created_at: '2025-01-01T00:00:00Z',
      };

      vi.mocked(apiClient.admin.listBannedUsers).mockResolvedValue({
        data: [bannedUser],
      } as Partial<AxiosResponse<unknown[]>>);

      renderAdminPage();

      // Click on Banned Users tab
      await userActions.click(screen.getByRole('button', { name: /banned users/i }));

      await waitFor(() => {
        expect(screen.getByText('banneduser')).toBeInTheDocument();
      });

      const unbanButton = screen.getByRole('button', { name: /unban user/i });
      await userActions.click(unbanButton);

      // Verify API was not called
      expect(apiClient.admin.unbanUser).not.toHaveBeenCalled();
    });

    it('shows error alert when unban fails', async () => {
      const userActions = userEvent.setup();
      const bannedUser = {
        id: 1,
        username: 'banneduser',
        email: 'banned@example.com',
        banned_at: '2025-10-21T12:00:00Z',
        banned_by_user_id: 2,
        banned_by_username: 'admin',
        created_at: '2025-01-01T00:00:00Z',
      };

      vi.mocked(apiClient.admin.listBannedUsers).mockResolvedValue({
        data: [bannedUser],
      } as Partial<AxiosResponse<unknown[]>>);

      vi.mocked(apiClient.admin.unbanUser).mockRejectedValue(
        new Error('API Error')
      );

      renderAdminPage();

      // Click on Banned Users tab
      await userActions.click(screen.getByRole('button', { name: /banned users/i }));

      await waitFor(() => {
        expect(screen.getByText('banneduser')).toBeInTheDocument();
      });

      const unbanButton = screen.getByRole('button', { name: /unban user/i });
      await userActions.click(unbanButton);

      // Error is shown via toast, not alert
      await waitFor(() => {
        expect(screen.getByText(/failed to unban user/i)).toBeInTheDocument();
      });
    });
  });

  describe('Admins Tab', () => {
    it('switches to admins tab when clicked', async () => {
      vi.mocked(apiClient.admin.listBannedUsers).mockResolvedValue({
        data: [],
      } as Partial<AxiosResponse<unknown[]>>);
      vi.mocked(apiClient.admin.listAdmins).mockResolvedValue({
        data: [],
      } as Partial<AxiosResponse<unknown[]>>);

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
      } as Partial<AxiosResponse<unknown[]>>);
      vi.mocked(apiClient.admin.listAdmins).mockResolvedValue({
        data: admins,
      } as Partial<AxiosResponse<unknown[]>>);

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
      } as Partial<AxiosResponse<unknown[]>>);
      vi.mocked(apiClient.admin.listAdmins).mockResolvedValue({
        data: [],
      } as Partial<AxiosResponse<unknown[]>>);

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
      } as Partial<AxiosResponse<unknown[]>>);
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
    it('shows Admin Mode tab by default', async () => {
      vi.mocked(apiClient.admin.listBannedUsers).mockResolvedValue({
        data: [],
      } as Partial<AxiosResponse<unknown[]>>);

      renderAdminPage();

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /^admin mode$/i })).toBeInTheDocument();
      });
    });

    it('switches between tabs correctly', async () => {
      vi.mocked(apiClient.admin.listBannedUsers).mockResolvedValue({
        data: [],
      } as Partial<AxiosResponse<unknown[]>>);
      vi.mocked(apiClient.admin.listAdmins).mockResolvedValue({
        data: [],
      } as Partial<AxiosResponse<unknown[]>>);

      renderAdminPage();

      // Start on Admin Mode tab
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /^admin mode$/i })).toBeInTheDocument();
      });

      // Switch to Admins tab
      const adminsTab = screen.getByRole('button', { name: /^admins$/i });
      await userEvent.click(adminsTab);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /administrator users/i })).toBeInTheDocument();
      });

      // Switch to Banned Users tab
      const bannedUsersTab = screen.getByRole('button', { name: /banned users/i });
      await userEvent.click(bannedUsersTab);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /^banned users$/i })).toBeInTheDocument();
      });
    });
  });

  describe('Grant Admin Functionality', () => {
    it('grants admin status when grant admin button is clicked and confirmed', async () => {
      const admins = [
        {
          id: 1,
          username: 'testadmin',
          email: 'test@example.com',
          createdAt: '2025-01-01T00:00:00Z',
        },
      ];

      vi.mocked(apiClient.admin.listBannedUsers).mockResolvedValue({
        data: [],
      } as Partial<AxiosResponse<unknown[]>>);
      vi.mocked(apiClient.admin.listAdmins).mockResolvedValue({
        data: admins,
      } as Partial<AxiosResponse<unknown[]>>);
      vi.mocked(apiClient.admin.grantAdminStatus).mockResolvedValue({} as Partial<AxiosResponse<unknown>>);

      renderAdminPage();

      // Switch to User Lookup tab
      const lookupTab = screen.getByRole('button', { name: /user lookup/i });
      await userEvent.click(lookupTab);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /user lookup/i })).toBeInTheDocument();
      });

      // Mock user lookup response for a non-admin user
      vi.mocked(apiClient.admin.getUserByUsername).mockResolvedValue({
        data: {
          id: 2,
          username: 'regularuser',
          email: 'regular@example.com',
          is_admin: false,
          is_banned: false,
          createdAt: '2025-01-02T00:00:00Z',
        },
      } as Partial<AxiosResponse<unknown>>);

      // Search for user
      const searchInput = screen.getByPlaceholderText(/enter username/i);
      const searchButton = screen.getByRole('button', { name: /search/i });

      await userEvent.type(searchInput, 'regularuser');
      await userEvent.click(searchButton);

      // Wait for user to appear
      await waitFor(() => {
        expect(screen.getByText('regularuser')).toBeInTheDocument();
      });

      // Click Grant Admin button
      const grantButton = screen.getByRole('button', { name: /grant admin/i });
      await userEvent.click(grantButton);

      // Verify confirmation dialog
      expect(mockConfirm).toHaveBeenCalledWith(
        'Are you sure you want to grant admin status to "regularuser"?'
      );

      // Verify API was called
      await waitFor(() => {
        expect(apiClient.admin.grantAdminStatus).toHaveBeenCalledWith(2);
      });

      // Verify success via toast
      await waitFor(() => {
        expect(screen.getByText('Admin status granted successfully')).toBeInTheDocument();
      });
    });

    it('does not grant admin when confirmation is cancelled', async () => {
      mockConfirm.mockReturnValue(false);

      vi.mocked(apiClient.admin.listBannedUsers).mockResolvedValue({
        data: [],
      } as Partial<AxiosResponse<unknown[]>>);
      vi.mocked(apiClient.admin.listAdmins).mockResolvedValue({
        data: [],
      } as Partial<AxiosResponse<unknown[]>>);
      vi.mocked(apiClient.admin.getUserByUsername).mockResolvedValue({
        data: {
          id: 2,
          username: 'regularuser',
          email: 'regular@example.com',
          is_admin: false,
          is_banned: false,
          createdAt: '2025-01-02T00:00:00Z',
        },
      } as Partial<AxiosResponse<unknown>>);

      renderAdminPage();

      const lookupTab = screen.getByRole('button', { name: /user lookup/i });
      await userEvent.click(lookupTab);

      const searchInput = screen.getByPlaceholderText(/enter username/i);
      const searchButton = screen.getByRole('button', { name: /search/i });

      await userEvent.type(searchInput, 'regularuser');
      await userEvent.click(searchButton);

      await waitFor(() => {
        expect(screen.getByText('regularuser')).toBeInTheDocument();
      });

      const grantButton = screen.getByRole('button', { name: /grant admin/i });
      await userEvent.click(grantButton);

      // Verify API was not called
      expect(apiClient.admin.grantAdminStatus).not.toHaveBeenCalled();
    });
  });

  describe('Revoke Admin with Self-Protection', () => {
    it('does not show revoke button for current user', async () => {
      const admins = [
        {
          id: 1, // Same as mocked currentUser.id
          username: 'testadmin',
          email: 'test@example.com',
          createdAt: '2025-01-01T00:00:00Z',
        },
        {
          id: 2,
          username: 'anotheradmin',
          email: 'another@example.com',
          createdAt: '2025-01-02T00:00:00Z',
        },
      ];

      vi.mocked(apiClient.admin.listBannedUsers).mockResolvedValue({
        data: [],
      } as Partial<AxiosResponse<unknown[]>>);
      vi.mocked(apiClient.admin.listAdmins).mockResolvedValue({
        data: admins,
      } as Partial<AxiosResponse<unknown[]>>);

      renderAdminPage();

      const adminsTab = screen.getByRole('button', { name: /^admins$/i });
      await userEvent.click(adminsTab);

      await waitFor(() => {
        expect(screen.getByText('testadmin')).toBeInTheDocument();
        expect(screen.getByText('anotheradmin')).toBeInTheDocument();
      });

      // Should see YOU badge for current user
      expect(screen.getByText('YOU')).toBeInTheDocument();

      // Should only see 1 Revoke Admin button (for anotheradmin, not testadmin)
      const revokeButtons = screen.getAllByRole('button', { name: /revoke admin/i });
      expect(revokeButtons).toHaveLength(1);
    });

    it('revokes admin status for other users', async () => {
      const admins = [
        {
          id: 1,
          username: 'testadmin',
          email: 'test@example.com',
          createdAt: '2025-01-01T00:00:00Z',
        },
        {
          id: 2,
          username: 'anotheradmin',
          email: 'another@example.com',
          createdAt: '2025-01-02T00:00:00Z',
        },
      ];

      vi.mocked(apiClient.admin.listBannedUsers).mockResolvedValue({
        data: [],
      } as Partial<AxiosResponse<unknown[]>>);
      vi.mocked(apiClient.admin.listAdmins).mockResolvedValue({
        data: admins,
      } as Partial<AxiosResponse<unknown[]>>);
      vi.mocked(apiClient.admin.revokeAdminStatus).mockResolvedValue({} as Partial<AxiosResponse<unknown>>);

      renderAdminPage();

      const adminsTab = screen.getByRole('button', { name: /^admins$/i });
      await userEvent.click(adminsTab);

      await waitFor(() => {
        expect(screen.getByText('anotheradmin')).toBeInTheDocument();
      });

      const revokeButton = screen.getByRole('button', { name: /revoke admin/i });
      await userEvent.click(revokeButton);

      // Verify confirmation dialog
      expect(mockConfirm).toHaveBeenCalledWith(
        'Are you sure you want to revoke admin status from "anotheradmin"?'
      );

      // Verify API was called
      await waitFor(() => {
        expect(apiClient.admin.revokeAdminStatus).toHaveBeenCalledWith(2);
      });

      // Verify success via toast
      await waitFor(() => {
        expect(screen.getByText('Admin status revoked successfully')).toBeInTheDocument();
      });
    });
  });

  describe('User Lookup Tab', () => {
    it('shows user lookup tab when clicked', async () => {
      vi.mocked(apiClient.admin.listBannedUsers).mockResolvedValue({
        data: [],
      } as Partial<AxiosResponse<unknown[]>>);

      renderAdminPage();

      const lookupTab = screen.getByRole('button', { name: /user lookup/i });
      await userEvent.click(lookupTab);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /user lookup/i })).toBeInTheDocument();
        expect(screen.getByPlaceholderText(/enter username/i)).toBeInTheDocument();
      });
    });

    it('searches for user and displays results', async () => {
      vi.mocked(apiClient.admin.listBannedUsers).mockResolvedValue({
        data: [],
      } as Partial<AxiosResponse<unknown[]>>);
      vi.mocked(apiClient.admin.getUserByUsername).mockResolvedValue({
        data: {
          id: 2,
          username: 'searchuser',
          email: 'search@example.com',
          is_admin: false,
          is_banned: false,
          createdAt: '2025-01-02T00:00:00Z',
        },
      } as Partial<AxiosResponse<unknown>>);

      renderAdminPage();

      const lookupTab = screen.getByRole('button', { name: /user lookup/i });
      await userEvent.click(lookupTab);

      const searchInput = screen.getByPlaceholderText(/enter username/i);
      const searchButton = screen.getByRole('button', { name: /search/i });

      await userEvent.type(searchInput, 'searchuser');
      await userEvent.click(searchButton);

      await waitFor(() => {
        expect(apiClient.admin.getUserByUsername).toHaveBeenCalledWith('searchuser');
        expect(screen.getByText('searchuser')).toBeInTheDocument();
        expect(screen.getByText('search@example.com')).toBeInTheDocument();
      });

      // Should show Ban User and Grant Admin buttons for non-admin user
      expect(screen.getByRole('button', { name: /ban user/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /grant admin/i })).toBeInTheDocument();
    });

    it('displays error message when user not found', async () => {
      vi.mocked(apiClient.admin.listBannedUsers).mockResolvedValue({
        data: [],
      } as Partial<AxiosResponse<unknown[]>>);
      vi.mocked(apiClient.admin.getUserByUsername).mockRejectedValue({
        response: { data: { error: 'user not found' } },
      });

      renderAdminPage();

      const lookupTab = screen.getByRole('button', { name: /user lookup/i });
      await userEvent.click(lookupTab);

      const searchInput = screen.getByPlaceholderText(/enter username/i);
      const searchButton = screen.getByRole('button', { name: /search/i });

      await userEvent.type(searchInput, 'nonexistent');
      await userEvent.click(searchButton);

      await waitFor(() => {
        expect(screen.getByText(/user not found/i)).toBeInTheDocument();
      });
    });

    it('shows appropriate buttons for admin users', async () => {
      vi.mocked(apiClient.admin.listBannedUsers).mockResolvedValue({
        data: [],
      } as Partial<AxiosResponse<unknown[]>>);
      vi.mocked(apiClient.admin.getUserByUsername).mockResolvedValue({
        data: {
          id: 2,
          username: 'adminuser',
          email: 'admin@example.com',
          is_admin: true,
          is_banned: false,
          createdAt: '2025-01-02T00:00:00Z',
        },
      } as Partial<AxiosResponse<unknown>>);

      renderAdminPage();

      const lookupTab = screen.getByRole('button', { name: /user lookup/i });
      await userEvent.click(lookupTab);

      const searchInput = screen.getByPlaceholderText(/enter username/i);
      const searchButton = screen.getByRole('button', { name: /search/i });

      await userEvent.type(searchInput, 'adminuser');
      await userEvent.click(searchButton);

      await waitFor(() => {
        expect(screen.getByText('adminuser')).toBeInTheDocument();
        expect(screen.getByText('ADMIN')).toBeInTheDocument();
      });

      // Should show Ban User and Revoke Admin buttons for admin user
      expect(screen.getByRole('button', { name: /ban user/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /revoke admin/i })).toBeInTheDocument();
      // Should NOT show Grant Admin button
      expect(screen.queryByRole('button', { name: /grant admin/i })).not.toBeInTheDocument();
    });

    it('hides action buttons for banned users', async () => {
      vi.mocked(apiClient.admin.listBannedUsers).mockResolvedValue({
        data: [],
      } as Partial<AxiosResponse<unknown[]>>);
      vi.mocked(apiClient.admin.getUserByUsername).mockResolvedValue({
        data: {
          id: 2,
          username: 'banneduser',
          email: 'banned@example.com',
          is_admin: false,
          is_banned: true,
          createdAt: '2025-01-02T00:00:00Z',
        },
      } as Partial<AxiosResponse<unknown>>);

      renderAdminPage();

      const lookupTab = screen.getByRole('button', { name: /user lookup/i });
      await userEvent.click(lookupTab);

      const searchInput = screen.getByPlaceholderText(/enter username/i);
      const searchButton = screen.getByRole('button', { name: /search/i });

      await userEvent.type(searchInput, 'banneduser');
      await userEvent.click(searchButton);

      await waitFor(() => {
        expect(screen.getByText('banneduser')).toBeInTheDocument();
        expect(screen.getByText('BANNED')).toBeInTheDocument();
      });

      // Should NOT show Ban User or Grant Admin buttons for banned user
      expect(screen.queryByRole('button', { name: /ban user/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /grant admin/i })).not.toBeInTheDocument();
    });

    it('hides all action buttons for current user', async () => {
      vi.mocked(apiClient.admin.listBannedUsers).mockResolvedValue({
        data: [],
      } as Partial<AxiosResponse<unknown[]>>);
      vi.mocked(apiClient.admin.getUserByUsername).mockResolvedValue({
        data: {
          id: 1, // Same as mocked currentUser.id
          username: 'testadmin',
          email: 'test@example.com',
          is_admin: true,
          is_banned: false,
          createdAt: '2025-01-01T00:00:00Z',
        },
      } as Partial<AxiosResponse<unknown>>);

      renderAdminPage();

      const lookupTab = screen.getByRole('button', { name: /user lookup/i });
      await userEvent.click(lookupTab);

      const searchInput = screen.getByPlaceholderText(/enter username/i);
      const searchButton = screen.getByRole('button', { name: /search/i });

      await userEvent.type(searchInput, 'testadmin');
      await userEvent.click(searchButton);

      await waitFor(() => {
        expect(screen.getByText('testadmin')).toBeInTheDocument();
        expect(screen.getByText('YOU')).toBeInTheDocument();
      });

      // Should NOT show any action buttons for current user
      expect(screen.queryByRole('button', { name: /ban user/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /grant admin/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /revoke admin/i })).not.toBeInTheDocument();
    });
  });
});
