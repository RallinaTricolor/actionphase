import axios from 'axios';

const API_BASE_URL = ''; // Use proxy in development

/**
 * Base API client with authentication and token refresh interceptors
 */
export class BaseApiClient {
  protected client: ReturnType<typeof axios.create>;
  protected refreshClient: ReturnType<typeof axios.create>;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Separate client for refresh requests to avoid interceptor loops
    this.refreshClient = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add request interceptor to include auth token and admin mode header
    this.client.interceptors.request.use((config) => {
      const token = localStorage.getItem('auth_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }

      // Add admin mode header if enabled
      const adminModeEnabled = localStorage.getItem('admin_mode_enabled');
      if (adminModeEnabled === 'true') {
        config.headers['X-Admin-Mode'] = 'true';
      }

      return config;
    });

    // Add response interceptor to handle token refresh
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        // Don't try to refresh token for auth endpoints (login, register)
        const isAuthEndpoint = originalRequest.url?.includes('/auth/login') ||
                               originalRequest.url?.includes('/auth/register');

        if (error.response?.status === 401 && !originalRequest._retry && !isAuthEndpoint) {
          originalRequest._retry = true;

          try {
            const token = localStorage.getItem('auth_token');
            if (!token) {
              throw new Error('No auth token available');
            }

            // Use separate client to avoid interceptor loop
            const response = await this.refreshClient.get('/api/v1/auth/refresh', {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            });

            const newToken = response.data.token;
            localStorage.setItem('auth_token', newToken);
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
            return this.client(originalRequest);
          } catch (refreshError) {
            console.error('Token refresh failed:', refreshError);
            localStorage.removeItem('auth_token');

            // Don't redirect if we're already on login page or public pages
            if (!window.location.pathname.includes('/login') &&
                !window.location.pathname.includes('/games') &&
                window.location.pathname !== '/') {
              window.location.href = '/login';
            }
            return Promise.reject(refreshError);
          }
        }

        return Promise.reject(error);
      }
    );
  }

  // Utility methods for token management
  setAuthToken(token: string) {
    if (!token || token.trim() === '' || token === 'undefined' || token === 'null') {
      console.error('Attempted to set invalid token:', token);
      localStorage.removeItem('auth_token');
      return;
    }
    console.log('Setting auth token:', token.substring(0, 50) + '...');
    localStorage.setItem('auth_token', token);
  }

  removeAuthToken() {
    localStorage.removeItem('auth_token');
  }

  getAuthToken(): string | null {
    return localStorage.getItem('auth_token');
  }

  // Health check
  async ping() {
    return this.client.get<string>('/ping');
  }
}
