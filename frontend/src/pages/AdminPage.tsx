import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api';
import type { AdminUser, BannedUser } from '../lib/api/admin';

export function AdminPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'admins' | 'banned'>('banned');

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
      alert('User banned successfully');
    },
    onError: (error) => {
      alert(`Failed to ban user: ${error}`);
    },
  });

  // Unban user mutation
  const unbanMutation = useMutation({
    mutationFn: (userId: number) => apiClient.admin.unbanUser(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bannedUsers'] });
      alert('User unbanned successfully');
    },
    onError: (error) => {
      alert(`Failed to unban user: ${error}`);
    },
  });

  const handleBanUser = (userId: number, username: string) => {
    if (window.confirm(`Are you sure you want to ban user "${username}"?`)) {
      banMutation.mutate(userId);
    }
  };

  const handleUnbanUser = (userId: number, username: string) => {
    if (window.confirm(`Are you sure you want to unban user "${username}"?`)) {
      unbanMutation.mutate(userId);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-content-primary mb-8">Admin Panel</h1>

      {/* Tab Navigation */}
      <div className="border-b border-theme-default mb-6">
        <nav className="flex space-x-8">
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
        </nav>
      </div>

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
                <div key={user.id} className="px-6 py-4">
                  <div className="flex items-center space-x-3">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <h3 className="text-lg font-medium text-content-primary">
                          {user.username}
                        </h3>
                        <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                          ADMIN
                        </span>
                      </div>
                      <p className="text-sm text-content-secondary mt-1">{user.email}</p>
                      <p className="text-xs text-content-tertiary mt-1">
                        Created: {new Date(user.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
