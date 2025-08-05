import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api';
import { simpleApi } from '../lib/simple-api';
import type { LoginRequest, RegisterRequest, AuthResponse } from '../types/auth';

export const useAuth = () => {
  const queryClient = useQueryClient();

  const loginMutation = useMutation({
    mutationFn: (data: LoginRequest) => apiClient.login(data),
    onSuccess: (response) => {
      apiClient.setAuthToken(response.data.token);
      queryClient.invalidateQueries({ queryKey: ['auth'] });
    },
  });

  const registerMutation = useMutation({
    mutationFn: (data: RegisterRequest) => apiClient.register(data),
    onSuccess: (response) => {
      apiClient.setAuthToken(response.data.token);
      queryClient.invalidateQueries({ queryKey: ['auth'] });
    },
  });

  const logout = () => {
    apiClient.removeAuthToken();
    queryClient.invalidateQueries({ queryKey: ['auth'] });
    queryClient.clear();
  };

  const isAuthenticated = !!apiClient.getAuthToken();

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
