import { BaseApiClient } from './client';
import type { AuthResponse, LoginRequest, RegisterRequest } from '../../types/auth';

type Theme = 'light' | 'dark' | 'auto';

interface UserPreferences {
  theme: Theme;
}

interface PreferencesResponse {
  preferences: UserPreferences;
}

/**
 * Authentication API client
 * Handles login, registration, token refresh, and user info
 */
export class AuthApi extends BaseApiClient {
  async login(data: LoginRequest) {
    return this.client.post<AuthResponse>('/api/v1/auth/login', data);
  }

  async register(data: RegisterRequest) {
    return this.client.post<AuthResponse>('/api/v1/auth/register', data);
  }

  async refreshToken() {
    const token = localStorage.getItem('auth_token');
    return this.refreshClient.get<{ token: string }>('/api/v1/auth/refresh', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  }

  async getCurrentUser() {
    return this.client.get<{ id: number; username: string; email: string }>('/api/v1/auth/me');
  }

  async getPreferences() {
    return this.client.get<PreferencesResponse>('/api/v1/auth/preferences');
  }

  async updatePreferences(preferences: UserPreferences) {
    return this.client.put<PreferencesResponse>('/api/v1/auth/preferences', {
      preferences,
    });
  }

  async searchUsers(query: string) {
    return this.client.get<{
      users: Array<{
        id: number;
        username: string;
        email: string;
        created_at: string;
      }>;
    }>(`/api/v1/auth/users/search?q=${encodeURIComponent(query)}`);
  }
}
