import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications, useMarkAllAsRead } from '../hooks/useNotifications';
import NotificationItem from './NotificationItem';

interface NotificationDropdownProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function NotificationDropdown({ isOpen, onClose }: NotificationDropdownProps) {
  const navigate = useNavigate();
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { data: notificationsData, isLoading, error } = useNotifications({ limit: 20 });
  const markAllAsRead = useMarkAllAsRead();

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleNavigate = (url: string) => {
    navigate(url);
    onClose();
  };

  const handleMarkAllAsRead = () => {
    markAllAsRead.mutate();
  };

  const notifications = notificationsData?.data || [];
  const hasUnread = notifications.some(n => !n.is_read);

  return (
    <div
      ref={dropdownRef}
      className="absolute right-0 top-full mt-2 w-96 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50"
      data-testid="notification-dropdown"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <h3 className="text-lg font-semibold">Notifications</h3>
        {hasUnread && (
          <button
            onClick={handleMarkAllAsRead}
            className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
            disabled={markAllAsRead.isPending}
          >
            {markAllAsRead.isPending ? 'Marking...' : 'Mark all read'}
          </button>
        )}
      </div>

      {/* Content */}
      <div className="max-h-96 overflow-y-auto">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
            <p className="mt-2">Loading notifications...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-red-400">
            <p>Failed to load notifications</p>
            <p className="text-sm text-gray-500 mt-1">Please try again later</p>
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            <svg className="w-16 h-16 mx-auto mb-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <p>No notifications</p>
            <p className="text-sm text-gray-500 mt-1">You're all caught up!</p>
          </div>
        ) : (
          notifications.map((notification) => (
            <NotificationItem
              key={notification.id}
              notification={notification}
              onNavigate={handleNavigate}
            />
          ))
        )}
      </div>

      {/* Footer */}
      {notifications.length > 0 && (
        <div className="p-3 border-t border-gray-700 text-center">
          <button
            onClick={() => {
              navigate('/notifications');
              onClose();
            }}
            className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
          >
            View all notifications
          </button>
        </div>
      )}
    </div>
  );
}
