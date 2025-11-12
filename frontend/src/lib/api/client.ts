import axios from 'axios';
import { logger, setCorrelationId } from '@/services/LoggingService';

const API_BASE_URL = ''; // Use proxy in development

/**
 * Base API client with authentication and token refresh interceptors
 */
export class BaseApiClient {
  protected client: ReturnType<typeof axios.create>;
  protected refreshClient: ReturnType<typeof axios.create>;
  private refreshPromise: Promise<void> | null = null;
  private sessionExpiredDispatched: boolean = false;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
      withCredentials: true, // Required to send HTTP-only cookies with requests
    });

    // Separate client for refresh requests to avoid interceptor loops
    this.refreshClient = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
      withCredentials: true, // Required to send HTTP-only cookies with requests
    });

    // Add request interceptor to include auth token and admin mode header
    // Note: Authentication uses BOTH localStorage tokens AND HTTP-only cookies
    // for backwards compatibility during migration
    this.client.interceptors.request.use((config) => {
      // Add Authorization header if token exists in localStorage
      const token = localStorage.getItem('auth_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }

      // Add admin mode header if enabled
      const adminModeEnabled = localStorage.getItem('admin_mode_enabled');
      if (adminModeEnabled === 'true') {
        config.headers['X-Admin-Mode'] = 'true';
      }

      // Log API request
      logger.debug('API Request', {
        method: config.method?.toUpperCase(),
        url: config.url,
        hasAuth: !!token,
        adminMode: adminModeEnabled === 'true',
      });

      return config;
    });

    // Add response interceptor to handle token refresh
    this.client.interceptors.response.use(
      (response) => {
        // Extract and store correlation ID from response headers
        const correlationId =
          response.headers['x-correlation-id'] ||
          response.headers['x-request-id'] ||
          null;

        if (correlationId) {
          setCorrelationId(correlationId);
        }

        // Log successful API response
        logger.debug('API Response', {
          method: response.config.method?.toUpperCase(),
          url: response.config.url,
          status: response.status,
          correlationId,
        });

        return response;
      },
      async (error) => {
        const originalRequest = error.config;

        // Log API error
        logger.error('API Request Failed', {
          method: error.config?.method?.toUpperCase(),
          url: error.config?.url,
          status: error.response?.status,
          error,
        });

        // Don't try to refresh token for auth endpoints (login, register, me)
        // /auth/me is used to CHECK if user is authenticated, so it shouldn't trigger refresh
        const isAuthEndpoint = originalRequest.url?.includes('/auth/login') ||
                               originalRequest.url?.includes('/auth/register') ||
                               originalRequest.url?.includes('/auth/me');

        if (error.response?.status === 401 && !originalRequest._retry && !isAuthEndpoint) {
          originalRequest._retry = true;

          logger.info('Token refresh needed', {
            url: originalRequest.url,
            method: originalRequest.method,
          });

          try {
            // If a refresh is already in progress, wait for it instead of starting a new one
            if (this.refreshPromise) {
              await this.refreshPromise;
              // Refresh completed, retry the original request
              logger.debug('Retrying request after token refresh', {
                url: originalRequest.url,
              });
              return this.client(originalRequest);
            }

            // Start a new refresh operation
            this.refreshPromise = this.performTokenRefresh();

            try {
              await this.refreshPromise;
              // Refresh successful, retry the original request
              logger.info('Token refresh successful, retrying request', {
                url: originalRequest.url,
              });
              // Reset the session expired flag on successful refresh
              // This allows showing the message again if session expires in the future
              this.sessionExpiredDispatched = false;
              return this.client(originalRequest);
            } finally {
              // Clear the refresh promise so future requests can trigger a new refresh if needed
              this.refreshPromise = null;
            }
          } catch (refreshError) {
            logger.error('Token refresh failed', {
              error: refreshError,
              originalUrl: originalRequest.url,
            });

            // Clear any legacy localStorage tokens
            localStorage.removeItem('auth_token');

            // Only dispatch events once to prevent infinite toast loop
            // Multiple requests may fail and enter this catch block, but we only
            // want to show the session expired message once
            if (!this.sessionExpiredDispatched) {
              this.sessionExpiredDispatched = true;

              // Dispatch event to show user-facing error message
              window.dispatchEvent(new CustomEvent('auth:sessionExpired', {
                detail: { message: 'Your session has expired. Please log in again.' }
              }));

              // Dispatch event to clear React Query cache
              window.dispatchEvent(new CustomEvent('auth:logout'));

              // Redirect to login page unless already there
              if (!window.location.pathname.includes('/login')) {
                logger.info('Redirecting to login after failed token refresh', {
                  from: window.location.pathname
                });
                window.location.href = '/login';
              }
            }
            return Promise.reject(refreshError);
          }
        }

        return Promise.reject(error);
      }
    );
  }

  /**
   * Performs the actual token refresh operation.
   * This method is called by the response interceptor and ensures
   * only one refresh happens at a time via the refreshPromise queue.
   */
  private async performTokenRefresh(): Promise<void> {
    // Authentication is now cookie-based. The refresh endpoint will read
    // the JWT from the HTTP-only cookie automatically.
    // No need to send Authorization header - the browser handles cookies.
    await this.refreshClient.get('/api/v1/auth/refresh');

    // The backend sets a new HTTP-only JWT cookie in the response.
    // We don't need to do anything with the token - the browser handles it.
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
    // Reset the session expired flag on successful authentication
    this.sessionExpiredDispatched = false;
  }

  removeAuthToken() {
    localStorage.removeItem('auth_token');
  }

  getAuthToken(): string | null {
    // With cookie-based authentication, we can't directly access the HTTP-only cookie.
    // Check localStorage for legacy token (for backwards compatibility during migration),
    // but always return a sentinel value indicating cookie-based auth is in use.
    // The actual authentication state should be verified by making an API call to /auth/me.
    const legacyToken = localStorage.getItem('auth_token');
    if (legacyToken) {
      // Legacy token exists, return it for backwards compatibility
      return legacyToken;
    }
    // No localStorage token, but cookies might be present
    // Return null - callers should verify auth via API call instead
    return null;
  }

  // Health check
  async ping() {
    return this.client.get<string>('/ping');
  }
}
