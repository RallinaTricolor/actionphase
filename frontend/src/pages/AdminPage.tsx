import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { AdminModeToggle } from '../components/AdminModeToggle';
import type { AdminUser, BannedUser, User } from '../lib/api/admin';

export function AdminPage() {
  const queryClient = useQueryClient();
  const { currentUser } = useAuth();
  const { showSuccess, showError } = useToast();
  const currentUserId = currentUser?.id;
  const [activeTab, setActiveTab] = useState<'mode' | 'admins' | 'banned' | 'lookup'>('mode');
  const [lookupUsername, setLookupUsername] = useState('');
  const [lookupResult, setLookupResult] = useState<User | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);

  // Fetch admins
  const {
    data: admins,
    isLoading: isLoadingAdmins,
    error: adminsError,
  } = useQuery({
    queryKey: ['admins'],
    queryFn: async () => {
      const response = await apiClient.admin.listAdmins();
      return response.data;
    },
  });

  // Fetch banned users
  const {
    data: bannedUsers,
    isLoading: isLoadingBanned,
    error: bannedError,
  } = useQuery({
    queryKey: ['bannedUsers'],
    queryFn: async () => {
      const response = await apiClient.admin.listBannedUsers();
      return response.data;
    },
  });

  // Ban user mutation
  const banMutation = useMutation({
    mutationFn: (userId: number) => apiClient.admin.banUser(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bannedUsers'] });
      queryClient.invalidateQueries({ queryKey: ['admins'] }); // User might lose admin status
      setLookupResult(null); // Clear lookup result after action
      showSuccess('User banned successfully');
    },
    onError: (error) => {
      showError(`Failed to ban user: ${error}`);
    },
  });

  // Unban user mutation
  const unbanMutation = useMutation({
    mutationFn: (userId: number) => apiClient.admin.unbanUser(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bannedUsers'] });
      showSuccess('User unbanned successfully');
    },
    onError: (error) => {
      showError(`Failed to unban user: ${error}`);
    },
  });

  // Revoke admin status mutation
  const revokeAdminMutation = useMutation({
    mutationFn: (userId: number) => apiClient.admin.revokeAdminStatus(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admins'] });
      setLookupResult(null); // Clear lookup result after action
      showSuccess('Admin status revoked successfully');
    },
    onError: (error) => {
      showError(`Failed to revoke admin status: ${error}`);
    },
  });

  // Grant admin status mutation
  const grantAdminMutation = useMutation({
    mutationFn: (userId: number) => apiClient.admin.grantAdminStatus(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admins'] });
      setLookupResult(null); // Clear lookup result after action
      showSuccess('Admin status granted successfully');
    },
    onError: (error) => {
      showError(`Failed to grant admin status: ${error}`);
    },
  });

  const handleBanUser = (userId: number, username: string) => {
    // eslint-disable-next-line no-alert
    if (confirm(`Are you sure you want to ban user ${username}?`)) {
      banMutation.mutate(userId);
    }
  };

  const handleUnbanUser = (userId: number, username: string) => {
    // eslint-disable-next-line no-alert
    if (confirm(`Are you sure you want to unban user ${username}?`)) {
      unbanMutation.mutate(userId);
    }
  };

  const handleRevokeAdmin = (userId: number, username: string) => {
    // eslint-disable-next-line no-alert
    if (confirm(`Are you sure you want to revoke admin status from ${username}?`)) {
      revokeAdminMutation.mutate(userId);
    }
  };

  const handleGrantAdmin = (userId: number, username: string) => {
    // eslint-disable-next-line no-alert
    if (confirm(`Are you sure you want to grant admin access to ${username}?`)) {
      grantAdminMutation.mutate(userId);
    }
  };

  const handleLookupUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setLookupError(null);
    setLookupResult(null);

    if (!lookupUsername.trim()) {
      setLookupError('Please enter a username');
      return;
    }

    try {
      const response = await apiClient.admin.getUserByUsername(lookupUsername.trim());
      setLookupResult(response.data);
    } catch (error: unknown) {
      setLookupError(error.response?.data?.error || 'User not found');
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-content-primary mb-8">Admin Panel</h1>

      {/* Tab Navigation */}
      <div className="border-b border-theme-default mb-6">
        <nav className="flex space-x-8">
          <button
            onClick={() => setActiveTab('mode')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'mode'
                ? 'border-interactive-primary text-interactive-primary'
                : 'border-transparent text-content-tertiary hover:text-content-secondary hover:border-content-tertiary'
            }`}
          >
            Admin Mode
          </button>
          <button
            onClick={() => setActiveTab('banned')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'banned'
                ? 'border-interactive-primary text-interactive-primary'
                : 'border-transparent text-content-tertiary hover:text-content-secondary hover:border-content-tertiary'
            }`}
          >
            Banned Users
          </button>
          <button
            onClick={() => setActiveTab('admins')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'admins'
                ? 'border-interactive-primary text-interactive-primary'
                : 'border-transparent text-content-tertiary hover:text-content-secondary hover:border-content-tertiary'
            }`}
          >
            Admins
          </button>
          <button
            onClick={() => setActiveTab('lookup')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'lookup'
                ? 'border-interactive-primary text-interactive-primary'
                : 'border-transparent text-content-tertiary hover:text-content-secondary hover:border-content-tertiary'
            }`}
          >
            User Lookup
          </button>
        </nav>
      </div>

      {/* Admin Mode Tab */}
      {activeTab === 'mode' && (
        <div className="bg-surface-base rounded-lg shadow">
          <div className="px-6 py-4 border-b border-theme-default">
            <h2 className="text-xl font-semibold text-content-primary">Admin Mode</h2>
            <p className="text-sm text-content-tertiary mt-1">
              Control your administrator privileges and visibility
            </p>
          </div>

          <div className="px-6 py-6">
            <div className="max-w-2xl">
              <div className="mb-4">
                <h3 className="text-lg font-medium text-content-primary mb-2">What is Admin Mode?</h3>
                <p className="text-sm text-content-secondary mb-4">
                  When Admin Mode is enabled, you'll see additional moderation controls throughout the site,
                  such as delete buttons on posts and comments. This allows you to quickly moderate content
                  without switching to the admin panel.
                </p>
                <p className="text-sm text-content-secondary mb-4">
                  When disabled, the site appears as it does to regular users, hiding all administrative controls.
                </p>
              </div>

              <div className="border-t border-theme-default pt-4">
                <AdminModeToggle />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Banned Users Tab */}
      {activeTab === 'banned' && (
        <div className="bg-surface-base rounded-lg shadow">
          <div className="px-6 py-4 border-b border-theme-default">
            <h2 className="text-xl font-semibold text-content-primary">Banned Users</h2>
            <p className="text-sm text-content-tertiary mt-1">
              Manage users who have been banned from the platform
            </p>
          </div>

          {isLoadingBanned ? (
            <div className="px-6 py-8 text-center text-content-tertiary">
              Loading banned users...
            </div>
          ) : bannedError ? (
            <div className="px-6 py-8 text-center text-red-500">
              Error loading banned users. You may not have admin permissions.
            </div>
          ) : !bannedUsers || bannedUsers.length === 0 ? (
            <div className="px-6 py-8 text-center text-content-tertiary">
              No banned users
            </div>
          ) : (
            <div className="divide-y divide-theme-default">
              {bannedUsers.map((user: BannedUser) => (
                <div key={user.id} className="px-6 py-4 hover:bg-surface-raised">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <h3 className="text-lg font-medium text-content-primary">
                          {user.username}
                        </h3>
                        <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded">
                          BANNED
                        </span>
                      </div>
                      <p className="text-sm text-content-secondary mt-1">{user.email}</p>
                      <div className="text-xs text-content-tertiary mt-2">
                        <p>
                          Banned by: <span className="font-medium">{user.banned_by_username}</span>
                        </p>
                        <p>
                          Banned at:{' '}
                          {new Date(user.banned_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleUnbanUser(user.id, user.username)}
                      disabled={unbanMutation.isPending}
                      className="ml-4 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {unbanMutation.isPending ? 'Unbanning...' : 'Unban User'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Admins Tab */}
      {activeTab === 'admins' && (
        <div className="bg-surface-base rounded-lg shadow">
          <div className="px-6 py-4 border-b border-theme-default">
            <h2 className="text-xl font-semibold text-content-primary">Administrator Users</h2>
            <p className="text-sm text-content-tertiary mt-1">
              Users with administrative privileges
            </p>
          </div>

          {isLoadingAdmins ? (
            <div className="px-6 py-8 text-center text-content-tertiary">
              Loading administrators...
            </div>
          ) : adminsError ? (
            <div className="px-6 py-8 text-center text-red-500">
              Error loading administrators. You may not have admin permissions.
            </div>
          ) : !admins || admins.length === 0 ? (
            <div className="px-6 py-8 text-center text-content-tertiary">
              No administrators found
            </div>
          ) : (
            <div className="divide-y divide-theme-default">
              {admins.map((user: AdminUser) => (
                <div key={user.id} className="px-6 py-4 hover:bg-surface-raised">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <h3 className="text-lg font-medium text-content-primary">
                          {user.username}
                        </h3>
                        <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                          ADMIN
                        </span>
                        {user.id === currentUserId && (
                          <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-600 rounded">
                            YOU
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-content-secondary mt-1">{user.email}</p>
                      <p className="text-xs text-content-tertiary mt-1">
                        Created: {new Date(user.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    {user.id !== currentUserId && (
                      <button
                        onClick={() => handleRevokeAdmin(user.id, user.username)}
                        disabled={revokeAdminMutation.isPending}
                        className="ml-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {revokeAdminMutation.isPending ? 'Revoking...' : 'Revoke Admin'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* User Lookup Tab */}
      {activeTab === 'lookup' && (
        <div className="bg-surface-base rounded-lg shadow">
          <div className="px-6 py-4 border-b border-theme-default">
            <h2 className="text-xl font-semibold text-content-primary">User Lookup</h2>
            <p className="text-sm text-content-tertiary mt-1">
              Search for users by username to manage their status
            </p>
          </div>

          <div className="px-6 py-6">
            <form onSubmit={handleLookupUser} className="max-w-md">
              <div className="flex gap-3">
                <input
                  type="text"
                  value={lookupUsername}
                  onChange={(e) => setLookupUsername(e.target.value)}
                  placeholder="Enter username"
                  className="flex-1 px-4 py-2 bg-surface-raised border border-theme-default rounded text-content-primary placeholder-content-tertiary focus:outline-none focus:ring-2 focus:ring-interactive-primary"
                />
                <button
                  type="submit"
                  className="px-6 py-2 bg-interactive-primary text-white rounded hover:bg-interactive-primary/90"
                >
                  Search
                </button>
              </div>
            </form>

            {lookupError && (
              <div className="mt-4 p-4 bg-red-100 border border-red-300 rounded text-red-800">
                {lookupError}
              </div>
            )}

            {lookupResult && (
              <div className="mt-6">
                <div className="p-6 bg-surface-raised rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <h3 className="text-xl font-semibold text-content-primary">
                          {lookupResult.username}
                        </h3>
                        {lookupResult.is_admin && (
                          <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                            ADMIN
                          </span>
                        )}
                        {lookupResult.is_banned && (
                          <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded">
                            BANNED
                          </span>
                        )}
                        {lookupResult.id === currentUserId && (
                          <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-600 rounded">
                            YOU
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-content-secondary mt-2">{lookupResult.email}</p>
                      <p className="text-xs text-content-tertiary mt-1">
                        Created: {new Date(lookupResult.createdAt).toLocaleDateString()}
                      </p>
                    </div>

                    <div className="flex gap-3 ml-4">
                      {!lookupResult.is_banned && lookupResult.id !== currentUserId && (
                        <button
                          onClick={() => handleBanUser(lookupResult.id, lookupResult.username)}
                          disabled={banMutation.isPending}
                          className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {banMutation.isPending ? 'Banning...' : 'Ban User'}
                        </button>
                      )}

                      {!lookupResult.is_admin && !lookupResult.is_banned && lookupResult.id !== currentUserId && (
                        <button
                          onClick={() => handleGrantAdmin(lookupResult.id, lookupResult.username)}
                          disabled={grantAdminMutation.isPending}
                          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {grantAdminMutation.isPending ? 'Granting...' : 'Grant Admin'}
                        </button>
                      )}

                      {lookupResult.is_admin && lookupResult.id !== currentUserId && (
                        <button
                          onClick={() => handleRevokeAdmin(lookupResult.id, lookupResult.username)}
                          disabled={revokeAdminMutation.isPending}
                          className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {revokeAdminMutation.isPending ? 'Revoking...' : 'Revoke Admin'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
