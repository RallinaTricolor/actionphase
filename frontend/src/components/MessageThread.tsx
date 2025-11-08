import { useState, useEffect, useRef, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';
import { Trash2 } from 'lucide-react';
import { apiClient } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { Button, Select, Textarea, Alert } from './ui';
import CharacterAvatar from './CharacterAvatar';
import type { PrivateMessage, ConversationWithDetails, ConversationListItem } from '../types/conversations';
import type { Character } from '../types/characters';
import { logger } from '@/services/LoggingService';

interface MessageThreadProps {
  gameId: number;
  conversationId: number;
  characters: Character[];
  onMarkedAsRead?: () => void;
  conversationInfo?: ConversationListItem; // For read tracking info
}

export function MessageThread({ gameId, conversationId, characters, onMarkedAsRead, conversationInfo }: MessageThreadProps) {
  const { currentUser } = useAuth();
  const { showError } = useToast();
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
  const [deleteMessageId, setDeleteMessageId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

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
      logger.debug('MessageThread scroll effect triggered', {
        messagesCount: messages.length,
        hasConversationInfo: !!conversationInfo,
        unreadCount: conversationInfo?.unread_count,
        lastReadAt: conversationInfo?.last_read_at,
        conversationId,
      });

      // If there are unread messages and we have read tracking info, scroll to first unread
      if (conversationInfo && conversationInfo.unread_count > 0 && conversationInfo.last_read_at) {
        logger.debug('Scrolling to first unread message', { conversationId, unreadCount: conversationInfo.unread_count });
        scrollToFirstUnread();
      } else {
        // Otherwise scroll to bottom (no unreads, or no tracking info yet)
        logger.debug('Scrolling to bottom (no unreads or no tracking info)', { conversationId });
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
      logger.debug('Marked conversation as read', { conversationId, gameId });
      // Notify parent to refresh conversation list
      if (onMarkedAsRead) {
        onMarkedAsRead();
      }
    } catch (err) {
      logger.error('Failed to mark conversation as read', { error: err, conversationId, gameId });
      // Don't show error to user - this is a background operation
    }
  };

  const scrollToBottom = () => {
    logger.debug('scrollToBottom called', { conversationId, refExists: !!messagesEndRef.current });
    if (typeof messagesEndRef.current?.scrollIntoView === 'function') {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
      logger.debug('Scrolled to bottom', { conversationId });
    } else {
      logger.warn('messagesEndRef not available for scrolling', { conversationId });
    }
  };

  const scrollToFirstUnread = () => {
    if (typeof firstUnreadRef.current?.scrollIntoView === 'function') {
      firstUnreadRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      logger.debug('Scrolled to first unread message', { conversationId });
    } else {
      // Fallback to bottom if ref not set
      scrollToBottom();
    }
  };

  // Find the first unread message based on last_read_at timestamp
  const getFirstUnreadIndex = () => {
    if (!conversationInfo || !conversationInfo.last_read_at) {
      logger.debug('No conversation info or last_read_at', { conversationId, hasInfo: !!conversationInfo });
      return -1; // No read tracking info
    }

    const lastReadTime = new Date(conversationInfo.last_read_at).getTime();
    const firstUnreadIndex = messages.findIndex(msg => {
      const msgTime = new Date(msg.created_at).getTime();
      return msgTime > lastReadTime;
    });

    logger.debug('getFirstUnreadIndex calculated', {
      conversationId,
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
      logger.error('Failed to load conversation', { error: err, gameId, conversationId });
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
      logger.error('Failed to load messages', { error: err, gameId, conversationId });
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
      logger.error('Failed to send message', { error: err, gameId, conversationId, characterId: selectedCharacterId });
      showError('Failed to send message. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const handleDeleteMessage = async () => {
    if (!deleteMessageId) return;

    try {
      setDeleting(true);
      await apiClient.conversations.deleteMessage(gameId, conversationId, deleteMessageId);

      // Reload messages to show "[Message deleted]"
      await loadMessages();
      setDeleteMessageId(null);
    } catch (err) {
      logger.error('Failed to delete message', { error: err, gameId, conversationId, messageId: deleteMessageId });
      showError('Failed to delete message. Please try again.');
    } finally {
      setDeleting(false);
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

                <div className="flex gap-3 group" data-testid="message">
                  <CharacterAvatar
                    avatarUrl={message.sender_avatar_url}
                    characterName={message.sender_character_name || message.sender_username}
                    size="sm"
                  />
                  <div className="flex flex-col flex-1">
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="font-semibold text-content-primary" data-testid="message-sender">
                        {message.sender_character_name || message.sender_username}
                      </span>
                      <span className="text-xs text-content-tertiary">
                        {formatTimestamp(message.created_at)}
                      </span>
                      {/* Delete button - only show for sender's messages */}
                      {currentUser && message.sender_user_id === currentUser.id && !message.is_deleted && (
                        <button
                          onClick={() => setDeleteMessageId(message.id)}
                          className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-semantic-danger hover:text-content-inverse rounded"
                          title="Delete message"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    {message.is_deleted ? (
                      <div className="surface-raised rounded-lg p-3 italic text-content-tertiary">
                        {message.content}
                      </div>
                    ) : (
                      <div className="surface-raised rounded-lg p-3 prose dark:prose-invert max-w-prose">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          rehypePlugins={[rehypeSanitize]}
                        >
                          {message.content}
                        </ReactMarkdown>
                      </div>
                    )}
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
                    maxLength={50000}
                    showCharacterCount={true}
                    helperText="Maximum 50,000 characters"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                        handleSendMessage(e);
                      }
                    }}
                  />
                </div>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <Button
                    type="submit"
                    variant="primary"
                    disabled={sending || !newMessage.trim()}
                >
                  {sending ? 'Sending...' : 'Send'}
                </Button>
                <p className="text-xs text-content-tertiary mt-1">
                  Press Ctrl/Cmd + Enter to send
                </p>
              </div>
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

      {/* Delete Confirmation Modal */}
      {deleteMessageId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="surface-base border border-theme-default rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-content-primary mb-4">Delete Message?</h3>
            <p className="text-content-secondary mb-6">
              This will permanently delete your message. Other participants will see "[Message deleted]" in its place.
            </p>
            <div className="flex gap-3 justify-end">
              <Button
                variant="secondary"
                onClick={() => setDeleteMessageId(null)}
                disabled={deleting}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={handleDeleteMessage}
                loading={deleting}
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
