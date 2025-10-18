import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import NotificationItem from './NotificationItem';
import type { Notification } from '../types/notifications';

// Setup MSW server
const server = setupServer();

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('NotificationItem', () => {
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

  const renderWithProviders = (component: React.ReactElement) => {
    return render(
      <QueryClientProvider client={queryClient}>
        {component}
      </QueryClientProvider>
    );
  };

  const createMockNotification = (overrides?: Partial<Notification>): Notification => ({
    id: 1,
    user_id: 1,
    game_id: 10,
    type: 'private_message',
    title: 'Test Notification',
    content: 'Test content',
    is_read: false,
    created_at: new Date().toISOString(),
    link_url: '/games/10',
    ...overrides,
  });

  it('displays notification title and content', () => {
    const notification = createMockNotification({
      title: 'New private message',
      content: 'John sent you a message',
    });

    renderWithProviders(<NotificationItem notification={notification} />);

    expect(screen.getByText('New private message')).toBeInTheDocument();
    expect(screen.getByText('John sent you a message')).toBeInTheDocument();
  });

  it('displays correct icon for notification type', () => {
    const notificationTypes = [
      { type: 'private_message', icon: '✉️' },
      { type: 'comment_reply', icon: '💬' },
      { type: 'character_mention', icon: '👤' },
      { type: 'action_submitted', icon: '⚡' },
      { type: 'action_result', icon: '📜' },
      { type: 'phase_created', icon: '🎯' },
    ];

    notificationTypes.forEach(({ type, icon }) => {
      const notification = createMockNotification({ type });
      const { unmount } = renderWithProviders(<NotificationItem notification={notification} />);

      expect(screen.getByText(icon)).toBeInTheDocument();

      unmount();
    });
  });

  it('shows unread indicator for unread notifications', () => {
    const notification = createMockNotification({ is_read: false });

    const { container } = renderWithProviders(<NotificationItem notification={notification} />);

    // Look for the blue dot indicator
    const unreadIndicator = container.querySelector('.bg-blue-500');
    expect(unreadIndicator).toBeInTheDocument();
  });

  it('does not show unread indicator for read notifications', () => {
    const notification = createMockNotification({ is_read: true });

    const { container } = renderWithProviders(<NotificationItem notification={notification} />);

    // Should not have blue dot
    const unreadIndicator = container.querySelector('.bg-blue-500');
    expect(unreadIndicator).not.toBeInTheDocument();
  });

  it('displays title with bold text when unread', () => {
    const notification = createMockNotification({ is_read: false, title: 'Unread message' });

    const { container } = renderWithProviders(<NotificationItem notification={notification} />);

    const titleElement = screen.getByText('Unread message');
    expect(titleElement.className).toContain('font-semibold');
  });

  it('displays title with normal weight when read', () => {
    const notification = createMockNotification({ is_read: true, title: 'Read message' });

    renderWithProviders(<NotificationItem notification={notification} />);

    const titleElement = screen.getByText('Read message');
    expect(titleElement.className).toContain('font-normal');
  });

  it('marks notification as read when clicked', async () => {
    const notification = createMockNotification({ is_read: false });
    const mockNavigate = vi.fn();

    server.use(
      http.put('/api/v1/notifications/:id/mark-read', () => {
        return HttpResponse.json({ success: true });
      })
    );

    const user = userEvent.setup();
    renderWithProviders(
      <NotificationItem notification={notification} onNavigate={mockNavigate} />
    );

    await user.click(screen.getByText('Test Notification'));

    await waitFor(() => {
      // Check that API was called
      expect(mockNavigate).toHaveBeenCalledWith('/games/10');
    });
  });

  it('does not mark already read notifications when clicked', async () => {
    const notification = createMockNotification({ is_read: true });
    const mockNavigate = vi.fn();

    let markReadCalled = false;
    server.use(
      http.put('/api/v1/notifications/:id/mark-read', () => {
        markReadCalled = true;
        return HttpResponse.json({ success: true });
      })
    );

    const user = userEvent.setup();
    renderWithProviders(
      <NotificationItem notification={notification} onNavigate={mockNavigate} />
    );

    await user.click(screen.getByText('Test Notification'));

    // Should still navigate
    expect(mockNavigate).toHaveBeenCalledWith('/games/10');

    // But should not call mark as read API
    await new Promise(resolve => setTimeout(resolve, 100));
    expect(markReadCalled).toBe(false);
  });

  it('navigates to link_url when clicked', async () => {
    const notification = createMockNotification({
      link_url: '/games/123#results',
    });
    const mockNavigate = vi.fn();

    const user = userEvent.setup();
    renderWithProviders(
      <NotificationItem notification={notification} onNavigate={mockNavigate} />
    );

    await user.click(screen.getByText('Test Notification'));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/games/123#results');
    });
  });

  it('does not navigate when link_url is not provided', async () => {
    const notification = createMockNotification({
      link_url: undefined,
    });
    const mockNavigate = vi.fn();

    const user = userEvent.setup();
    renderWithProviders(
      <NotificationItem notification={notification} onNavigate={mockNavigate} />
    );

    await user.click(screen.getByText('Test Notification'));

    // Wait a bit to ensure no navigation
    await new Promise(resolve => setTimeout(resolve, 100));
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('deletes notification when delete button is clicked', async () => {
    const notification = createMockNotification();

    server.use(
      http.delete('/api/v1/notifications/:id', () => {
        return HttpResponse.json({ success: true });
      })
    );

    // Mock window.confirm
    window.confirm = vi.fn(() => true);

    const user = userEvent.setup();
    renderWithProviders(<NotificationItem notification={notification} />);

    const deleteButton = screen.getByTitle('Delete notification');
    await user.click(deleteButton);

    // Should show confirmation
    expect(window.confirm).toHaveBeenCalledWith('Delete this notification?');

    // Should call API
    await waitFor(() => {
      // Verify the mutation was triggered
      expect(queryClient.isMutating()).toBeGreaterThan(0);
    });
  });

  it('does not delete notification when confirmation is cancelled', async () => {
    const notification = createMockNotification();

    let deleteCalled = false;
    server.use(
      http.delete('/api/v1/notifications/:id', () => {
        deleteCalled = true;
        return HttpResponse.json({ success: true });
      })
    );

    // Mock window.confirm to return false
    window.confirm = vi.fn(() => false);

    const user = userEvent.setup();
    renderWithProviders(<NotificationItem notification={notification} />);

    const deleteButton = screen.getByTitle('Delete notification');
    await user.click(deleteButton);

    // Should show confirmation
    expect(window.confirm).toHaveBeenCalled();

    // Should NOT call API
    await new Promise(resolve => setTimeout(resolve, 100));
    expect(deleteCalled).toBe(false);
  });

  it('displays relative timestamp', () => {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const notification = createMockNotification({
      created_at: fiveMinutesAgo,
    });

    renderWithProviders(<NotificationItem notification={notification} />);

    // date-fns formatDistanceToNow should produce something like "5 minutes ago"
    expect(screen.getByText(/minutes ago/i)).toBeInTheDocument();
  });

  it('stops propagation when delete button is clicked', async () => {
    const notification = createMockNotification();
    const mockNavigate = vi.fn();

    window.confirm = vi.fn(() => true);

    server.use(
      http.delete('/api/v1/notifications/:id', () => {
        return HttpResponse.json({ success: true });
      })
    );

    const user = userEvent.setup();
    renderWithProviders(
      <NotificationItem notification={notification} onNavigate={mockNavigate} />
    );

    const deleteButton = screen.getByTitle('Delete notification');
    await user.click(deleteButton);

    // Should not trigger navigation (event.stopPropagation should prevent it)
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
