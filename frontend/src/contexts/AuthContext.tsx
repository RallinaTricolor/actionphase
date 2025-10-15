import React, { createContext, useContext, useEffect, useState } from 'react';
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

  // Check if user is authenticated based on token
  const { data: isAuthenticated, isLoading: isCheckingAuth } = useQuery({
    queryKey: ['auth'],
    queryFn: () => {
      const hasToken = !!apiClient.getAuthToken();
      console.log('[AuthContext] Checking authentication:', hasToken);
      return hasToken;
    },
    initialData: () => !!apiClient.getAuthToken(),
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  // Fetch current user data when authenticated
  const {
    data: currentUser,
    isLoading: isLoadingUser,
    error: userError
  } = useQuery({
    queryKey: ['currentUser'],
    queryFn: async () => {
      console.log('[AuthContext] Fetching current user data');
      const response = await apiClient.getCurrentUser();
      console.log('[AuthContext] Current user loaded:', response.data);
      return response.data;
    },
    enabled: isAuthenticated === true,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    retry: 1,
  });

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
      const response = await apiClient.login(data);
      return response;
    },
    onSuccess: (response) => {
      const token = response.data.Token || response.data.token;
      console.log('[AuthContext] Login successful, token received:', !!token);

      if (token) {
        apiClient.setAuthToken(token);
        queryClient.setQueryData(['auth'], true);
        // Invalidate user query to trigger immediate fetch
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
      const response = await apiClient.register(data);
      return response;
    },
    onSuccess: (response) => {
      const token = response.data.Token || response.data.token;
      console.log('[AuthContext] Registration successful, token received:', !!token);

      if (token) {
        apiClient.setAuthToken(token);
        queryClient.setQueryData(['auth'], true);
        // Invalidate user query to trigger immediate fetch
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
  const logout = () => {
    console.log('[AuthContext] Logging out');
    apiClient.removeAuthToken();
    queryClient.setQueryData(['auth'], false);
    queryClient.setQueryData(['currentUser'], null);
    queryClient.clear();
    setAuthError(null);
  };

  // Combined loading state
  const isLoading = loginMutation.isPending || registerMutation.isPending;

  const value: AuthContextValue = {
    currentUser: currentUser || null,
    isAuthenticated: isAuthenticated || false,
    isLoading,
    isCheckingAuth: isCheckingAuth || isLoadingUser,
    login: loginMutation.mutateAsync,
    register: registerMutation.mutateAsync,
    logout,
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
