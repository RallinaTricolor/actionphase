import { useState, useEffect, useRef, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';
import { apiClient } from '../lib/api';
import type { PrivateMessage, ConversationWithDetails } from '../types/conversations';
import type { Character } from '../types/characters';

interface MessageThreadProps {
  gameId: number;
  conversationId: number;
  characters: Character[];
}

export function MessageThread({ gameId, conversationId, characters }: MessageThreadProps) {
  const [messages, setMessages] = useState<PrivateMessage[]>([]);
  const [conversation, setConversation] = useState<ConversationWithDetails | null>(null);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [loadingConversation, setLoadingConversation] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [selectedCharacterId, setSelectedCharacterId] = useState<number | null>(null);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const loading = loadingMessages || loadingConversation;

  // Filter characters to only show conversation participants
  const participantCharacters = useMemo(() => {
    if (!conversation || !conversation.participants) return characters;

    const participantCharacterIds = conversation.participants
      .map(p => p.character_id)
      .filter((id): id is number => id !== null);

    return characters.filter(char => participantCharacterIds.includes(char.id));
  }, [conversation, characters]);

  // Auto-select first character from participants, and reset if current selection is not a participant
  useEffect(() => {
    if (participantCharacters.length > 0) {
      // If no character selected, or selected character is not in participants, select the first participant
      if (selectedCharacterId === null || !participantCharacters.some(c => c.id === selectedCharacterId)) {
        setSelectedCharacterId(participantCharacters[0].id);
      }
    }
  }, [participantCharacters, selectedCharacterId]);

  useEffect(() => {
    loadConversation();
    loadMessages();
  }, [gameId, conversationId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    if (typeof messagesEndRef.current?.scrollIntoView === 'function') {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const loadConversation = async () => {
    try {
      setLoadingConversation(true);
      const response = await apiClient.getConversation(gameId, conversationId);
      setConversation(response.data);
    } catch (err) {
      console.error('Failed to load conversation:', err);
      setError('Failed to load conversation');
    } finally {
      setLoadingConversation(false);
    }
  };

  const loadMessages = async () => {
    try {
      setLoadingMessages(true);
      // Don't clear error if conversation loading failed
      if (!error) {
        setError(null);
      }
      const response = await apiClient.getConversationMessages(gameId, conversationId);
      setMessages(response.data.messages || []);

      // Mark conversation as read
      await apiClient.markConversationAsRead(gameId, conversationId);
    } catch (err) {
      console.error('Failed to load messages:', err);
      setError('Failed to load messages');
    } finally {
      setLoadingMessages(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCharacterId || !newMessage.trim() || sending) return;

    try {
      setSending(true);
      await apiClient.sendMessage(gameId, conversationId, {
        character_id: selectedCharacterId,
        content: newMessage.trim(),
      });

      setNewMessage('');
      await loadMessages();
    } catch (err) {
      console.error('Failed to send message:', err);
      alert('Failed to send message. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const formatTimestamp = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-600">Loading messages...</div>
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

  return (
    <div className="flex flex-col h-full">
      {/* Conversation Header */}
      {conversation && conversation.conversation && (
        <div className="bg-white border-b border-gray-200 p-4">
          <h2 className="text-xl font-bold text-gray-900">
            {conversation.conversation.title || 'Untitled Conversation'}
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Participants: {conversation.participants?.map(p => p.character_name || p.username).join(', ') || 'None'}
          </p>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-gray-500">
              <p className="mb-2">No messages yet</p>
              <p className="text-sm">Start the conversation!</p>
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <div key={message.id} className="flex flex-col">
              <div className="flex items-baseline gap-2 mb-1">
                <span className="font-semibold text-gray-900">
                  {message.sender_character_name || message.sender_username}
                </span>
                <span className="text-xs text-gray-500">
                  {formatTimestamp(message.created_at)}
                </span>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 prose prose-sm max-w-none">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeSanitize]}
                >
                  {message.content}
                </ReactMarkdown>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <div className="bg-white border-t border-gray-200 p-4">
        <form onSubmit={handleSendMessage}>
          {participantCharacters.length > 0 ? (
            <>
              {participantCharacters.length > 1 && (
                <select
                  value={selectedCharacterId || ''}
                  onChange={(e) => setSelectedCharacterId(Number(e.target.value))}
                  className="w-full mb-3 px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={sending}
                >
                  {participantCharacters.map((char) => (
                    <option key={char.id} value={char.id}>
                      Send as {char.name}
                    </option>
                  ))}
                </select>
              )}

              <div className="flex gap-2">
                <textarea
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="Type your message... (Markdown supported)"
                  disabled={sending}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                      handleSendMessage(e);
                    }
                  }}
                />
                <button
                  type="submit"
                  disabled={sending || !newMessage.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium self-end"
                >
                  {sending ? 'Sending...' : 'Send'}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Press Ctrl/Cmd + Enter to send
              </p>
            </>
          ) : (
            <p className="text-sm text-gray-600">
              {characters.length === 0
                ? "You need a character to send messages."
                : "You don't have any characters participating in this conversation."}
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
