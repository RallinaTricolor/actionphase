import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api';
import type { GetNotificationsParams } from '../types/notifications';

export function useNotifications(params?: GetNotificationsParams) {
  return useQuery({
    queryKey: ['notifications', params],
    queryFn: async () => {
      const response = await apiClient.notifications.getNotifications(params);
      return response.data;
    },
    // Poll every 30 seconds for new notifications
    refetchInterval: 30000,
    // Always refetch when component mounts to ensure fresh data when dropdown opens
    refetchOnMount: 'always',
    // Refetch when window regains focus
    refetchOnWindowFocus: true,
  });
}

export function useUnreadCount() {
  return useQuery({
    queryKey: ['notifications', 'unreadCount'],
    queryFn: async () => {
      const response = await apiClient.notifications.getUnreadCount();
      return response.data.unread_count;
    },
    // Poll every 15 seconds for unread count (more frequent for bell badge)
    refetchInterval: 15000,
  });
}

export function useMarkNotificationAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationId: number) => {
      const response = await apiClient.notifications.markNotificationAsRead(notificationId);
      return response.data;
    },
    onSuccess: () => {
      // Invalidate queries to refetch
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useMarkAllAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const response = await apiClient.notifications.markAllNotificationsAsRead();
      return response.data;
    },
    onSuccess: () => {
      // Invalidate queries to refetch
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useDeleteNotification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationId: number) => {
      await apiClient.notifications.deleteNotification(notificationId);
    },
    onSuccess: () => {
      // Invalidate queries to refetch
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}
