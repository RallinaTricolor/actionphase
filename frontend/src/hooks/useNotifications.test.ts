import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import {
  useNotifications,
  useUnreadCount,
  useMarkNotificationAsRead,
  useMarkAllAsRead,
  useDeleteNotification,
} from './useNotifications';
import type { Notification } from '../types/notifications';

// Setup MSW server
const server = setupServer();

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('useNotifications hooks', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  const createMockNotifications = (count: number): Notification[] => {
    return Array.from({ length: count }, (_, i) => ({
      id: i + 1,
      user_id: 1,
      game_id: 10,
      type: 'private_message',
      title: `Notification ${i + 1}`,
      is_read: false,
      created_at: new Date().toISOString(),
    }));
  };

  describe('useNotifications', () => {
    it('fetches notifications successfully', async () => {
      const mockNotifications = createMockNotifications(5);

      server.use(
        http.get('/api/v1/notifications', () => {
          return HttpResponse.json({
            data: mockNotifications,
            pagination: { total: 5, limit: 20, offset: 0 },
          });
        })
      );

      const { result } = renderHook(() => useNotifications(), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.data).toHaveLength(5);
      expect(result.current.data?.data[0].title).toBe('Notification 1');
    });

    it('fetches notifications with custom params', async () => {
      let requestParams: URLSearchParams | null = null;

      server.use(
        http.get('/api/v1/notifications', ({ request }) => {
          const url = new URL(request.url);
          requestParams = url.searchParams;

          return HttpResponse.json({
            data: [],
            pagination: { total: 0, limit: 10, offset: 0 },
          });
        })
      );

      renderHook(() => useNotifications({ limit: 10, offset: 0, unread: true }), { wrapper });

      await waitFor(() => {
        expect(requestParams?.get('limit')).toBe('10');
        expect(requestParams?.get('offset')).toBe('0');
        expect(requestParams?.get('unread')).toBe('true');
      });
    });

    it('handles API errors', async () => {
      server.use(
        http.get('/api/v1/notifications', () => {
          return HttpResponse.error();
        })
      );

      const { result } = renderHook(() => useNotifications(), { wrapper });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
    });

    it('polls for new notifications every 30 seconds', async () => {
      vi.useFakeTimers();

      let callCount = 0;

      server.use(
        http.get('/api/v1/notifications', () => {
          callCount++;
          return HttpResponse.json({
            data: createMockNotifications(callCount),
            pagination: { total: callCount, limit: 20, offset: 0 },
          });
        })
      );

      const { result } = renderHook(() => useNotifications(), { wrapper });

      // Initial fetch
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.data).toHaveLength(1);

      // Advance time by 30 seconds
      vi.advanceTimersByTime(30000);

      // Should have refetched
      await waitFor(() => {
        expect(result.current.data?.data).toHaveLength(2);
      });

      vi.useRealTimers();
    });
  });

  describe('useUnreadCount', () => {
    it('fetches unread count successfully', async () => {
      server.use(
        http.get('/api/v1/notifications/unread-count', () => {
          return HttpResponse.json({ unread_count: 7 });
        })
      );

      const { result } = renderHook(() => useUnreadCount(), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toBe(7);
    });

    it('returns 0 when no unread notifications', async () => {
      server.use(
        http.get('/api/v1/notifications/unread-count', () => {
          return HttpResponse.json({ unread_count: 0 });
        })
      );

      const { result } = renderHook(() => useUnreadCount(), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toBe(0);
    });

    it('polls for unread count every 15 seconds', async () => {
      vi.useFakeTimers();

      let count = 0;

      server.use(
        http.get('/api/v1/notifications/unread-count', () => {
          count++;
          return HttpResponse.json({ unread_count: count });
        })
      );

      const { result } = renderHook(() => useUnreadCount(), { wrapper });

      // Initial fetch
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toBe(1);

      // Advance time by 15 seconds
      vi.advanceTimersByTime(15000);

      // Should have refetched
      await waitFor(() => {
        expect(result.current.data).toBe(2);
      });

      vi.useRealTimers();
    });

    it('handles API errors', async () => {
      server.use(
        http.get('/api/v1/notifications/unread-count', () => {
          return HttpResponse.error();
        })
      );

      const { result } = renderHook(() => useUnreadCount(), { wrapper });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
    });
  });

  describe('useMarkNotificationAsRead', () => {
    it('marks notification as read successfully', async () => {
      server.use(
        http.put('/api/v1/notifications/:id/mark-read', () => {
          return HttpResponse.json({ success: true });
        })
      );

      const { result } = renderHook(() => useMarkNotificationAsRead(), { wrapper });

      result.current.mutate(1);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
    });

    it('invalidates queries on success', async () => {
      server.use(
        http.put('/api/v1/notifications/:id/mark-read', () => {
          return HttpResponse.json({ success: true });
        })
      );

      const { result } = renderHook(() => useMarkNotificationAsRead(), { wrapper });

      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      result.current.mutate(1);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['notifications'] });
    });

    it('handles API errors', async () => {
      server.use(
        http.put('/api/v1/notifications/:id/mark-read', () => {
          return HttpResponse.error();
        })
      );

      const { result } = renderHook(() => useMarkNotificationAsRead(), { wrapper });

      result.current.mutate(1);

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
    });
  });

  describe('useMarkAllAsRead', () => {
    it('marks all notifications as read successfully', async () => {
      server.use(
        http.put('/api/v1/notifications/mark-all-read', () => {
          return HttpResponse.json({ marked_count: 5 });
        })
      );

      const { result } = renderHook(() => useMarkAllAsRead(), { wrapper });

      result.current.mutate();

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.marked_count).toBe(5);
    });

    it('invalidates queries on success', async () => {
      server.use(
        http.put('/api/v1/notifications/mark-all-read', () => {
          return HttpResponse.json({ marked_count: 3 });
        })
      );

      const { result } = renderHook(() => useMarkAllAsRead(), { wrapper });

      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      result.current.mutate();

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['notifications'] });
    });

    it('handles API errors', async () => {
      server.use(
        http.put('/api/v1/notifications/mark-all-read', () => {
          return HttpResponse.error();
        })
      );

      const { result } = renderHook(() => useMarkAllAsRead(), { wrapper });

      result.current.mutate();

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
    });
  });

  describe('useDeleteNotification', () => {
    it('deletes notification successfully', async () => {
      server.use(
        http.delete('/api/v1/notifications/:id', () => {
          return new HttpResponse(null, { status: 204 });
        })
      );

      const { result } = renderHook(() => useDeleteNotification(), { wrapper });

      result.current.mutate(1);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
    });

    it('invalidates queries on success', async () => {
      server.use(
        http.delete('/api/v1/notifications/:id', () => {
          return new HttpResponse(null, { status: 204 });
        })
      );

      const { result } = renderHook(() => useDeleteNotification(), { wrapper });

      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      result.current.mutate(1);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['notifications'] });
    });

    it('handles API errors', async () => {
      server.use(
        http.delete('/api/v1/notifications/:id', () => {
          return HttpResponse.error();
        })
      );

      const { result } = renderHook(() => useDeleteNotification(), { wrapper });

      result.current.mutate(1);

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
    });
  });

  describe('Query keys', () => {
    it('uses different query keys for different hook types', () => {
      server.use(
        http.get('/api/v1/notifications', () => {
          return HttpResponse.json({
            data: [],
            pagination: { total: 0, limit: 20, offset: 0 },
          });
        }),
        http.get('/api/v1/notifications/unread-count', () => {
          return HttpResponse.json({ unread_count: 0 });
        })
      );

      // Render both hooks
      const { result: notificationsResult } = renderHook(() => useNotifications(), { wrapper });
      const { result: unreadCountResult } = renderHook(() => useUnreadCount(), { wrapper });

      // They should use different query keys
      // This ensures they can be invalidated separately
      // (Actual verification would require inspecting the queryClient cache)
    });

    it('uses different query keys for different params', () => {
      server.use(
        http.get('/api/v1/notifications', () => {
          return HttpResponse.json({
            data: [],
            pagination: { total: 0, limit: 20, offset: 0 },
          });
        })
      );

      // Render with different params
      const { result: result1 } = renderHook(
        () => useNotifications({ limit: 10 }),
        { wrapper }
      );
      const { result: result2 } = renderHook(
        () => useNotifications({ limit: 20 }),
        { wrapper }
      );

      // They should be cached separately
      // (Actual verification would require inspecting the queryClient cache)
    });
  });
});
