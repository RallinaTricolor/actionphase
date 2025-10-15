import { useState, useEffect } from 'react';
import { apiClient } from '../lib/api';
import type { ConversationListItem } from '../types/conversations';

interface ConversationListProps {
  gameId: number;
  onSelectConversation: (conversationId: number) => void;
  selectedConversationId?: number;
}

export function ConversationList({ gameId, onSelectConversation, selectedConversationId }: ConversationListProps) {
  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadConversations();
  }, [gameId]);

  const loadConversations = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.getUserConversations(gameId);
      console.log('[ConversationList] Loaded conversations:', response.data.conversations);
      setConversations(response.data.conversations || []);
    } catch (err) {
      console.error('Failed to load conversations:', err);
      setError('Failed to load conversations');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-600">Loading conversations...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error}
        </div>
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <p className="text-gray-600 text-lg mb-2">No conversations yet</p>
          <p className="text-gray-500 text-sm">Start a conversation with other characters in the game</p>
        </div>
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-200">
      {conversations.map((conversation) => (
        <button
          key={conversation.id}
          onClick={() => {
            console.log('[ConversationList] Clicked conversation:', conversation);
            onSelectConversation(conversation.id);
          }}
          className={`w-full text-left p-4 hover:bg-gray-50 transition-colors ${
            selectedConversationId === conversation.id ? 'bg-blue-50 border-l-4 border-blue-600' : ''
          }`}
        >
          <div className="flex items-start justify-between mb-2">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-gray-900 truncate">
                {conversation.title || 'Untitled Conversation'}
              </h3>
              <p className="text-sm text-gray-600 truncate">
                {conversation.participant_names || `${conversation.participant_count} ${conversation.participant_count === 1 ? 'participant' : 'participants'}`}
              </p>
            </div>
            {conversation.last_message_at && (
              <span className="text-xs text-gray-500 ml-2 flex-shrink-0">
                {formatDate(conversation.last_message_at)}
              </span>
            )}
          </div>

          {conversation.last_message && (
            <p className="text-sm text-gray-600 truncate">
              {conversation.last_message}
            </p>
          )}
        </button>
      ))}
    </div>
  );
}
