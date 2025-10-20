import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications, useMarkAllAsRead } from '../hooks/useNotifications';
import NotificationItem from './NotificationItem';

interface NotificationDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  bellButtonRef?: React.RefObject<HTMLButtonElement>;
}

export default function NotificationDropdown({ isOpen, onClose, bellButtonRef }: NotificationDropdownProps) {
  const navigate = useNavigate();
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { data: notificationsData, isLoading, error } = useNotifications({ limit: 20 });
  const markAllAsRead = useMarkAllAsRead();

  // Close dropdown when clicking outside (but not on the bell button)
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const clickedDropdown = dropdownRef.current && dropdownRef.current.contains(target);
      const clickedBell = bellButtonRef?.current && bellButtonRef.current.contains(target);

      if (!clickedDropdown && !clickedBell) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose, bellButtonRef]);

  const handleNavigate = (url: string) => {
    navigate(url);
    onClose();
  };

  const handleMarkAllAsRead = () => {
    markAllAsRead.mutate();
  };

  const notifications = notificationsData?.data || [];
  const hasUnread = notifications.some(n => !n.is_read);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      ref={dropdownRef}
      className="absolute right-0 top-full mt-2 w-96 bg-white border border-gray-200 rounded-lg shadow-xl z-50"
      data-testid="notification-dropdown"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">Notifications</h3>
        {hasUnread && (
          <button
            onClick={handleMarkAllAsRead}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
            disabled={markAllAsRead.isPending}
          >
            {markAllAsRead.isPending ? 'Marking...' : 'Mark all read'}
          </button>
        )}
      </div>

      {/* Content */}
      <div className="max-h-96 overflow-y-auto">
        {isLoading ? (
          <div className="p-8 text-center text-gray-600">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2">Loading notifications...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-red-600">
            <p className="font-medium">Failed to load notifications</p>
            <p className="text-sm text-gray-600 mt-1">Please try again later</p>
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-8 text-center text-gray-600">
            <svg className="w-16 h-16 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <p className="font-medium">No notifications</p>
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

      {/* Footer - Always show "View all" link */}
      <div className="p-3 border-t border-gray-200 text-center">
        <button
          onClick={() => {
            navigate('/notifications');
            onClose();
          }}
          className="text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
        >
          View all notifications
        </button>
      </div>
    </div>
  );
}
