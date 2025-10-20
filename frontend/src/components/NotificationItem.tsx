import { formatDistanceToNow } from 'date-fns';
import type { Notification } from '../types/notifications';
import { useMarkNotificationAsRead, useDeleteNotification } from '../hooks/useNotifications';

interface NotificationItemProps {
  notification: Notification;
  onNavigate?: (url: string) => void;
}

export default function NotificationItem({ notification, onNavigate }: NotificationItemProps) {
  const markAsRead = useMarkNotificationAsRead();
  const deleteNotification = useDeleteNotification();

  const handleClick = () => {
    // Mark as read
    if (!notification.is_read) {
      markAsRead.mutate(notification.id);
    }

    // Navigate if link_url is provided
    if (notification.link_url && onNavigate) {
      onNavigate(notification.link_url);
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Delete this notification?')) {
      deleteNotification.mutate(notification.id);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'private_message':
        return '✉️';
      case 'comment_reply':
        return '💬';
      case 'character_mention':
        return '👤';
      case 'action_submitted':
        return '⚡';
      case 'action_result':
        return '📜';
      case 'common_room_post':
        return '📣';
      case 'phase_created':
        return '🎯';
      case 'application_approved':
        return '✅';
      case 'application_rejected':
        return '❌';
      case 'character_approved':
        return '✅';
      case 'character_rejected':
        return '⚠️';
      case 'game_state_changed':
        return '🎮';
      default:
        return '🔔';
    }
  };

  return (
    <div
      onClick={handleClick}
      className={`
        notification-item
        flex items-start gap-3 p-4 border-b border-gray-200
        ${notification.is_read ? 'bg-white' : 'bg-blue-50'}
        ${notification.link_url ? 'cursor-pointer hover:bg-gray-50' : ''}
        transition-colors
      `}
    >
      {/* Icon */}
      <div className="text-2xl flex-shrink-0">
        {getNotificationIcon(notification.type)}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <h4 className={`text-sm text-gray-900 ${!notification.is_read ? 'font-semibold' : 'font-normal'}`}>
              {notification.title}
            </h4>
            {notification.content && (
              <p className="text-sm text-gray-600 mt-1">{notification.content}</p>
            )}
          </div>

          {/* Unread indicator */}
          {!notification.is_read && (
            <div className="w-2 h-2 bg-blue-600 rounded-full flex-shrink-0 mt-1"></div>
          )}
        </div>

        {/* Timestamp */}
        <p className="text-xs text-gray-500 mt-2">
          {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
        </p>
      </div>

      {/* Delete button */}
      <button
        onClick={handleDelete}
        className="text-gray-400 hover:text-red-600 transition-colors flex-shrink-0"
        title="Delete notification"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
