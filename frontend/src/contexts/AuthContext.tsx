import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api';
import type { LoginRequest, RegisterRequest, User } from '../types/auth';
import { logger } from '@/services/LoggingService';
import { getSavedDrafts } from '@/utils/draftRestoration';
import { useToast } from './ToastContext';

interface AuthContextValue {
  // User data
  currentUser: User | null;
  isAuthenticated: boolean;

  // Loading states
  isLoading: boolean;
  isCheckingAuth: boolean;

  // Auth methods
  login: (data: LoginRequest) => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
  logout: () => void;
  clearError: () => void;

  // Error state
  error: Error | null;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const queryClient = useQueryClient();
  const [authError, setAuthError] = useState<Error | null>(null);
  const { showSuccess } = useToast();

  // Check if user is authenticated by fetching current user data
  // This works for both localStorage tokens AND HTTP-only cookies
  // Note: This query runs on all pages (including public ones) which causes 401 errors
  // in the console for unauthenticated users. This is expected and normal behavior.
  const {
    data: currentUser,
    isLoading: isCheckingAuth,
    error: userError,
    isError: hasAuthError,
  } = useQuery({
    queryKey: ['currentUser'],
    queryFn: async () => {
      logger.debug('Checking authentication via /auth/me');
      try {
        const response = await apiClient.auth.getCurrentUser();
        logger.debug('Authentication successful', { userId: response.data.id, username: response.data.username });
        return response.data;
      } catch (error) {
        logger.debug('Not authenticated');
        throw error;
      }
    },
    retry: false,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    refetchOnWindowFocus: true,
  });

  // Derive authentication state from currentUser query
  const isAuthenticated = !hasAuthError && currentUser !== undefined;

  // Log user error if it occurs
  useEffect(() => {
    if (userError) {
      logger.error('Failed to load user data', { error: userError });
      setAuthError(userError as Error);
    }
  }, [userError]);

  // Track whether we've already shown the draft restoration toast
  const draftToastShownRef = useRef(false);

  // Check for and restore saved drafts when user becomes authenticated
  // This helps recover work-in-progress when session expires
  useEffect(() => {
    // Only check when user first becomes authenticated and auth check is complete
    // AND we haven't already shown the toast
    if (isAuthenticated && !isCheckingAuth && !draftToastShownRef.current) {
      const draftData = getSavedDrafts();
      if (draftData) {
        logger.info('Found saved drafts after login', {
          draftCount: Object.keys(draftData.drafts).length,
          originalPath: draftData.path,
        });

        // Mark that we've shown the toast
        draftToastShownRef.current = true;

        // Show toast with path information and clear the drafts
        // Users can navigate back if needed, but we won't keep showing the toast
        const draftCount = Object.keys(draftData.drafts).length;
        const pathDisplay = draftData.path === '/' ? 'home page' : draftData.path;
        const message = `We found ${draftCount} unsaved draft${draftCount > 1 ? 's' : ''} from ${pathDisplay}. Navigate back to that page to see your restored work, or continue - we won't remind you again.`;

        showSuccess(message);

        // Clear the drafts from localStorage so the toast doesn't reappear
        localStorage.removeItem('session_expired_drafts');
      }
    }
  }, [isAuthenticated, isCheckingAuth, showSuccess]);

  // Login mutation
  const loginMutation = useMutation({
    mutationFn: async (data: LoginRequest) => {
      logger.debug('Attempting login', { username: data.username });
      const response = await apiClient.auth.login(data);
      return response;
    },
    onSuccess: (response) => {
      const token = response.data.Token || response.data.token;
      logger.info('Login successful', { hasToken: !!token });

      if (token) {
        apiClient.setAuthToken(token);
        // Invalidate currentUser query to trigger authentication check
        queryClient.invalidateQueries({ queryKey: ['currentUser'] });
        setAuthError(null);
      }
    },
    onError: (error: Error) => {
      logger.error('Login failed', { error });
      setAuthError(error);
    },
  });

  // Register mutation
  const registerMutation = useMutation({
    mutationFn: async (data: RegisterRequest) => {
      logger.debug('Attempting registration', { username: data.username, email: data.email });
      const response = await apiClient.auth.register(data);
      return response;
    },
    onSuccess: (response) => {
      const token = response.data.Token || response.data.token;
      logger.info('Registration successful', { hasToken: !!token });

      if (token) {
        apiClient.setAuthToken(token);
        // Invalidate currentUser query to trigger authentication check
        queryClient.invalidateQueries({ queryKey: ['currentUser'] });
        setAuthError(null);
      }
    },
    onError: (error: Error) => {
      logger.error('Registration failed', { error });
      setAuthError(error);
    },
  });

  // Logout function
  const logout = async () => {
    logger.info('User logging out');
    try {
      // Call backend to invalidate session/clear cookie
      await apiClient.auth.logout();
      logger.debug('Backend logout successful');
    } catch (error) {
      // Log error but continue with frontend logout
      logger.error('Backend logout failed', { error });
    } finally {
      // Always clear frontend state regardless of backend response
      apiClient.removeAuthToken();
      queryClient.setQueryData(['currentUser'], null);
      queryClient.clear();
      setAuthError(null);
    }
  };

  // Listen for logout events from API client (e.g., when token refresh fails)
  useEffect(() => {
    const handleLogout = () => {
      logger.info('Handling auth:logout event - clearing React Query cache');
      queryClient.setQueryData(['currentUser'], null);
      queryClient.clear();
      setAuthError(null);
    };

    window.addEventListener('auth:logout', handleLogout);

    return () => {
      window.removeEventListener('auth:logout', handleLogout);
    };
  }, [queryClient]);

  // Combined loading state
  const isLoading = loginMutation.isPending || registerMutation.isPending;

  // Function to clear auth errors - memoized to prevent infinite loops
  const clearError = useCallback(() => {
    setAuthError(null);
    loginMutation.reset();
    registerMutation.reset();
  }, [loginMutation, registerMutation]);

  const value: AuthContextValue = {
    currentUser: currentUser || null,
    isAuthenticated: isAuthenticated || false,
    isLoading,
    isCheckingAuth: isCheckingAuth,
    login: async (data: LoginRequest) => {
      await loginMutation.mutateAsync(data);
    },
    register: async (data: RegisterRequest) => {
      await registerMutation.mutateAsync(data);
    },
    logout,
    clearError,
    error: authError || loginMutation.error || registerMutation.error,
  };

  logger.debug('AuthContext state updated', {
    isAuthenticated: value.isAuthenticated,
    hasUser: !!value.currentUser,
    userId: value.currentUser?.id,
    isLoading: value.isLoading,
    isCheckingAuth: value.isCheckingAuth,
  });

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
