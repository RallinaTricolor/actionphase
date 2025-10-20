import { Link } from 'react-router-dom';
import type { DashboardMessage } from '../types/dashboard';
import { MessageSquare, Clock } from 'lucide-react';

interface RecentActivityCardProps {
  messages: DashboardMessage[];
}

/**
 * RecentActivityCard - Display recent messages from games
 */
export function RecentActivityCard({ messages }: RecentActivityCardProps) {
  if (messages.length === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
      <div className="flex items-center mb-4">
        <MessageSquare className="w-5 h-5 text-gray-600 mr-2" />
        <h2 className="text-lg font-bold text-gray-900">Recent Activity</h2>
      </div>
      <div className="space-y-4">
        {messages.map((message) => (
          <Link
            key={message.message_id}
            to={`/games/${message.game_id}`}
            className="block border-b border-gray-100 pb-4 last:border-b-0 last:pb-0 hover:bg-gray-50 -mx-2 px-2 py-2 rounded transition-colors"
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">
                  {message.game_title}
                </p>
                <p className="text-xs text-gray-600">
                  {message.character_name
                    ? `${message.author_name} as ${message.character_name}`
                    : message.author_name}
                </p>
              </div>
              <div className="ml-2 flex items-center text-xs text-gray-500">
                <Clock className="w-3 h-3 mr-1" />
                {formatMessageTime(message.created_at)}
              </div>
            </div>
            <p className="text-sm text-gray-700 line-clamp-2">{message.content}</p>
            <p className="text-xs text-gray-500 mt-1">
              {message.message_type === 'post' ? 'Post' :
               message.message_type === 'comment' ? 'Comment' :
               'Private message'}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}

/**
 * Format message timestamp as relative time
 */
function formatMessageTime(timestamp: string): string {
  const now = new Date();
  const messageDate = new Date(timestamp);
  const minutesAgo = Math.floor((now.getTime() - messageDate.getTime()) / (1000 * 60));

  if (minutesAgo < 1) {
    return 'Just now';
  } else if (minutesAgo < 60) {
    return `${minutesAgo}m ago`;
  } else if (minutesAgo < 1440) { // 24 hours
    const hoursAgo = Math.floor(minutesAgo / 60);
    return `${hoursAgo}h ago`;
  } else {
    const daysAgo = Math.floor(minutesAgo / 1440);
    return `${daysAgo}d ago`;
  }
}
