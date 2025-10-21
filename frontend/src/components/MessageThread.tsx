import { useState, useEffect, useRef, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';
import { apiClient } from '../lib/api';
import { Button, Select, Textarea, Alert } from './ui';
import type { PrivateMessage, ConversationWithDetails, ConversationListItem } from '../types/conversations';
import type { Character } from '../types/characters';

interface MessageThreadProps {
  gameId: number;
  conversationId: number;
  characters: Character[];
  onMarkedAsRead?: () => void;
  conversationInfo?: ConversationListItem; // For read tracking info
}

export function MessageThread({ gameId, conversationId, characters, onMarkedAsRead, conversationInfo }: MessageThreadProps) {
  const [messages, setMessages] = useState<PrivateMessage[]>([]);
  const [conversation, setConversation] = useState<ConversationWithDetails | null>(null);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [loadingConversation, setLoadingConversation] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [selectedCharacterId, setSelectedCharacterId] = useState<number | null>(null);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const firstUnreadRef = useRef<HTMLDivElement>(null);
  const [hasScrolledToUnread, setHasScrolledToUnread] = useState(false);

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

  // Scroll to first unread message or bottom
  useEffect(() => {
    if (messages.length > 0 && !hasScrolledToUnread) {
      console.log('[MessageThread] Scroll effect triggered:', {
        messagesCount: messages.length,
        hasConversationInfo: !!conversationInfo,
        unreadCount: conversationInfo?.unread_count,
        lastReadAt: conversationInfo?.last_read_at,
      });

      // If there are unread messages and we have read tracking info, scroll to first unread
      if (conversationInfo && conversationInfo.unread_count > 0 && conversationInfo.last_read_at) {
        console.log('[MessageThread] Scrolling to first unread, unread_count:', conversationInfo.unread_count);
        scrollToFirstUnread();
      } else {
        // Otherwise scroll to bottom (no unreads, or no tracking info yet)
        console.log('[MessageThread] Scrolling to bottom (no unreads or no tracking info)');
        // Use setTimeout to ensure DOM is fully rendered
        setTimeout(() => scrollToBottom(), 50);
      }
      setHasScrolledToUnread(true);

      // Mark as read AFTER scrolling
      markAsRead();
    }
  }, [messages, hasScrolledToUnread, conversationInfo]);

  // Reset scroll state when conversation changes
  useEffect(() => {
    setHasScrolledToUnread(false);
  }, [conversationId]);

  const markAsRead = async () => {
    try {
      await apiClient.conversations.markConversationAsRead(gameId, conversationId);
      console.log('[MessageThread] Marked conversation as read:', conversationId);
      // Notify parent to refresh conversation list
      if (onMarkedAsRead) {
        onMarkedAsRead();
      }
    } catch (err) {
      console.error('Failed to mark conversation as read:', err);
      // Don't show error to user - this is a background operation
    }
  };

  const scrollToBottom = () => {
    console.log('[MessageThread] scrollToBottom called, ref exists:', !!messagesEndRef.current);
    if (typeof messagesEndRef.current?.scrollIntoView === 'function') {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
      console.log('[MessageThread] Scrolled to bottom');
    } else {
      console.warn('[MessageThread] messagesEndRef not available for scrolling');
    }
  };

  const scrollToFirstUnread = () => {
    if (typeof firstUnreadRef.current?.scrollIntoView === 'function') {
      firstUnreadRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      console.log('[MessageThread] Scrolled to first unread message');
    } else {
      // Fallback to bottom if ref not set
      scrollToBottom();
    }
  };

  // Find the first unread message based on last_read_at timestamp
  const getFirstUnreadIndex = () => {
    if (!conversationInfo || !conversationInfo.last_read_at) {
      console.log('[MessageThread] No conversation info or last_read_at:', { conversationInfo });
      return -1; // No read tracking info
    }

    const lastReadTime = new Date(conversationInfo.last_read_at).getTime();
    const firstUnreadIndex = messages.findIndex(msg => {
      const msgTime = new Date(msg.created_at).getTime();
      return msgTime > lastReadTime;
    });

    console.log('[MessageThread] getFirstUnreadIndex:', {
      lastReadTime: new Date(lastReadTime).toISOString(),
      firstUnreadIndex,
      messagesCount: messages.length,
      firstMessage: messages[0]?.created_at,
      lastMessage: messages[messages.length - 1]?.created_at,
    });

    return firstUnreadIndex;
  };

  const loadConversation = async () => {
    try {
      setLoadingConversation(true);
      const response = await apiClient.conversations.getConversation(gameId, conversationId);
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
      const response = await apiClient.conversations.getConversationMessages(gameId, conversationId);
      setMessages(response.data.messages || []);

      // DON'T mark as read here - we'll do it after scrolling in the effect
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
      await apiClient.conversations.sendMessage(gameId, conversationId, {
        character_id: selectedCharacterId,
        content: newMessage.trim(),
      });

      setNewMessage('');
      await loadMessages();

      // Scroll to bottom after sending (use setTimeout to ensure messages are rendered)
      setTimeout(() => scrollToBottom(), 100);
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
        <div className="text-content-secondary">Loading messages...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <Alert variant="danger">
          {error}
        </Alert>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Conversation Header */}
      {conversation && conversation.conversation && (
        <div className="surface-base border-b border-theme-default p-4">
          <h2 className="text-xl font-bold text-content-primary">
            {conversation.conversation.title || 'Untitled Conversation'}
          </h2>
          <p className="text-sm text-content-secondary mt-1">
            Participants: {conversation.participants?.map(p => p.character_name || p.username).join(', ') || 'None'}
          </p>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-content-secondary">
              <p className="mb-2">No messages yet</p>
              <p className="text-sm">Start the conversation!</p>
            </div>
          </div>
        ) : (
          messages.map((message, index) => {
            const isFirstUnread = index === getFirstUnreadIndex();

            return (
              <div key={message.id}>
                {/* "New messages" divider */}
                {isFirstUnread && (
                  <div ref={firstUnreadRef} className="flex items-center gap-3 my-6">
                    <div className="flex-1 h-px bg-gradient-to-r from-transparent via-interactive-primary to-interactive-primary"></div>
                    <span className="text-sm font-semibold text-interactive-primary px-3 py-1 bg-interactive-primary-subtle rounded-full border border-interactive-primary">
                      New messages
                    </span>
                    <div className="flex-1 h-px bg-gradient-to-l from-transparent via-interactive-primary to-interactive-primary"></div>
                  </div>
                )}

                <div className="flex flex-col">
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="font-semibold text-content-primary">
                      {message.sender_character_name || message.sender_username}
                    </span>
                    <span className="text-xs text-content-tertiary">
                      {formatTimestamp(message.created_at)}
                    </span>
                  </div>
                  <div className="surface-raised rounded-lg p-3 prose dark:prose-invert prose-sm max-w-none">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      rehypePlugins={[rehypeSanitize]}
                    >
                      {message.content}
                    </ReactMarkdown>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <div className="surface-base border-t border-theme-default p-4">
        <form onSubmit={handleSendMessage}>
          {participantCharacters.length > 0 ? (
            <>
              {participantCharacters.length > 1 && (
                <div className="mb-3">
                  <Select
                    value={selectedCharacterId?.toString() || ''}
                    onChange={(e) => setSelectedCharacterId(Number(e.target.value))}
                    disabled={sending}
                  >
                    {participantCharacters.map((char) => (
                      <option key={char.id} value={char.id}>
                        Send as {char.name}
                      </option>
                    ))}
                  </Select>
                </div>
              )}

              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <Textarea
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    rows={3}
                    placeholder="Type your message... (Markdown supported)"
                    disabled={sending}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                        handleSendMessage(e);
                      }
                    }}
                  />
                </div>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={sending || !newMessage.trim()}
                >
                  {sending ? 'Sending...' : 'Send'}
                </Button>
              </div>
              <p className="text-xs text-content-tertiary mt-1">
                Press Ctrl/Cmd + Enter to send
              </p>
            </>
          ) : (
            <p className="text-sm text-content-secondary">
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
