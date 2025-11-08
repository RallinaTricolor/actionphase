import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api';
import { simpleApi } from '../lib/simple-api';
import type { LoginRequest, RegisterRequest } from '../types/auth';
import { logger } from '@/services/LoggingService';

export const useAuth = () => {
  const queryClient = useQueryClient();

  const loginMutation = useMutation({
    mutationFn: (data: LoginRequest) => apiClient.auth.login(data),
    onSuccess: (response) => {
      // Handle both Token (backend) and token (lowercase) formats
      const token = response.data.Token || response.data.token;
      logger.info('Login success', { hasToken: !!token });
      if (token) {
        apiClient.setAuthToken(token);
        // Immediately set the auth state to true
        queryClient.setQueryData(['auth'], true);
      }
    },
  });

  const registerMutation = useMutation({
    mutationFn: (data: RegisterRequest) => apiClient.auth.register(data),
    onSuccess: (response) => {
      // Handle both Token (backend) and token (lowercase) formats
      const token = response.data.Token || response.data.token;
      logger.info('Registration success', { hasToken: !!token });
      if (token) {
        apiClient.setAuthToken(token);
        // Immediately set the auth state to true
        queryClient.setQueryData(['auth'], true);
      }
    },
  });

  const logout = () => {
    apiClient.removeAuthToken();
    // Immediately set auth state to false
    queryClient.setQueryData(['auth'], false);
    queryClient.clear();
  };

  // Use useQuery to make isAuthenticated reactive to token changes
  const { data: isAuthenticated, isLoading: isCheckingAuth } = useQuery({
    queryKey: ['auth'],
    queryFn: () => {
      const hasToken = !!apiClient.getAuthToken();
      logger.debug('Checking auth token', { hasToken });
      return hasToken;
    },
    // Set initial data from localStorage to avoid flash of unauthenticated state
    initialData: () => !!apiClient.getAuthToken(),
    staleTime: 0, // Always check fresh
    refetchOnWindowFocus: true,
  });

  logger.debug('useAuth state', { isAuthenticated, isCheckingAuth });

  return {
    login: loginMutation.mutateAsync,
    register: registerMutation.mutateAsync,
    logout,
    isAuthenticated,
    isLoading: loginMutation.isPending || registerMutation.isPending,
    error: loginMutation.error || registerMutation.error,
  };
};

export const usePing = () => {
  return useQuery({
    queryKey: ['ping'],
    queryFn: () => simpleApi.ping(),
    retry: 1,
  });
};
