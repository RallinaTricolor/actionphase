import { BaseApiClient } from './client';

export interface AdminUser {
  id: number;
  username: string;
  email: string;
  createdAt: string;
}

export interface BannedUser {
  id: number;
  username: string;
  email: string;
  banned_at: string;
  banned_by_user_id: number;
  banned_by_username: string;
  created_at: string;
}

export interface User {
  id: number;
  username: string;
  email: string;
  is_admin: boolean;
  is_banned: boolean;
  createdAt: string;
}

/**
 * Admin API client
 * Handles admin operations like user management, banning, etc.
 */
export class AdminApi extends BaseApiClient {
  /**
   * List all users with admin privileges
   */
  async listAdmins() {
    return this.client.get<AdminUser[]>('/api/v1/admin/admins');
  }

  /**
   * Grant admin privileges to a user
   */
  async grantAdminStatus(userId: number) {
    return this.client.put(`/api/v1/admin/users/${userId}/admin`, {});
  }

  /**
   * Revoke admin privileges from a user
   */
  async revokeAdminStatus(userId: number) {
    return this.client.delete(`/api/v1/admin/users/${userId}/admin`);
  }

  /**
   * Ban a user from the platform
   */
  async banUser(userId: number) {
    return this.client.post(`/api/v1/admin/users/${userId}/ban`, {});
  }

  /**
   * Unban a user
   */
  async unbanUser(userId: number) {
    return this.client.delete(`/api/v1/admin/users/${userId}/ban`);
  }

  /**
   * List all banned users
   */
  async listBannedUsers() {
    return this.client.get<BannedUser[]>('/api/v1/admin/users/banned');
  }

  /**
   * Look up a user by username
   */
  async getUserByUsername(username: string) {
    return this.client.get<User>(`/api/v1/admin/users/lookup/${username}`);
  }

  /**
   * Delete a message (post or comment) (soft delete)
   */
  async deleteMessage(messageId: number) {
    return this.client.delete(`/api/v1/admin/messages/${messageId}`);
  }
}
