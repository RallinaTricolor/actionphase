import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api';
import { simpleApi } from '../lib/simple-api';
import type { LoginRequest, RegisterRequest } from '../types/auth';

export const useAuth = () => {
  const queryClient = useQueryClient();

  const loginMutation = useMutation({
    mutationFn: (data: LoginRequest) => apiClient.login(data),
    onSuccess: (response) => {
      // Handle both Token (backend) and token (lowercase) formats
      const token = response.data.Token || response.data.token;
      console.log('Login success, token received:', !!token);
      if (token) {
        apiClient.setAuthToken(token);
      }
      queryClient.invalidateQueries({ queryKey: ['auth'] });
    },
  });

  const registerMutation = useMutation({
    mutationFn: (data: RegisterRequest) => apiClient.register(data),
    onSuccess: (response) => {
      // Handle both Token (backend) and token (lowercase) formats
      const token = response.data.Token || response.data.token;
      console.log('Register success, token received:', !!token);
      if (token) {
        apiClient.setAuthToken(token);
      }
      queryClient.invalidateQueries({ queryKey: ['auth'] });
    },
  });

  const logout = () => {
    apiClient.removeAuthToken();
    queryClient.invalidateQueries({ queryKey: ['auth'] });
    queryClient.clear();
  };

  // Use useQuery to make isAuthenticated reactive to token changes
  const { data: isAuthenticated = false } = useQuery({
    queryKey: ['auth'],
    queryFn: () => !!apiClient.getAuthToken(),
    staleTime: 0, // Always check fresh
    refetchOnWindowFocus: true,
  });

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
