import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api';
import type { LoginRequest, RegisterRequest, User } from '../types/auth';

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
      console.log('[AuthContext] Checking authentication via /auth/me');
      try {
        const response = await apiClient.auth.getCurrentUser();
        console.log('[AuthContext] Authentication successful:', response.data);
        return response.data;
      } catch (error) {
        console.log('[AuthContext] Not authenticated');
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
      console.error('[AuthContext] Failed to load user data:', userError);
      setAuthError(userError as Error);
    }
  }, [userError]);

  // Login mutation
  const loginMutation = useMutation({
    mutationFn: async (data: LoginRequest) => {
      console.log('[AuthContext] Attempting login');
      const response = await apiClient.auth.login(data);
      return response;
    },
    onSuccess: (response) => {
      const token = response.data.Token || response.data.token;
      console.log('[AuthContext] Login successful, token received:', !!token);

      if (token) {
        apiClient.setAuthToken(token);
        // Invalidate currentUser query to trigger authentication check
        queryClient.invalidateQueries({ queryKey: ['currentUser'] });
        setAuthError(null);
      }
    },
    onError: (error: Error) => {
      console.error('[AuthContext] Login failed:', error);
      setAuthError(error);
    },
  });

  // Register mutation
  const registerMutation = useMutation({
    mutationFn: async (data: RegisterRequest) => {
      console.log('[AuthContext] Attempting registration');
      const response = await apiClient.auth.register(data);
      return response;
    },
    onSuccess: (response) => {
      const token = response.data.Token || response.data.token;
      console.log('[AuthContext] Registration successful, token received:', !!token);

      if (token) {
        apiClient.setAuthToken(token);
        // Invalidate currentUser query to trigger authentication check
        queryClient.invalidateQueries({ queryKey: ['currentUser'] });
        setAuthError(null);
      }
    },
    onError: (error: Error) => {
      console.error('[AuthContext] Registration failed:', error);
      setAuthError(error);
    },
  });

  // Logout function
  const logout = async () => {
    console.log('[AuthContext] Logging out');
    try {
      // Call backend to invalidate session/clear cookie
      await apiClient.auth.logout();
      console.log('[AuthContext] Backend logout successful');
    } catch (error) {
      // Log error but continue with frontend logout
      console.error('[AuthContext] Backend logout failed:', error);
    } finally {
      // Always clear frontend state regardless of backend response
      apiClient.removeAuthToken();
      queryClient.setQueryData(['currentUser'], null);
      queryClient.clear();
      setAuthError(null);
    }
  };

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

  console.log('[AuthContext] Context state:', {
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
