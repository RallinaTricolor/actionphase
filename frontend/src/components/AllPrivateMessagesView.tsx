import { useState, useEffect, useMemo } from 'react';
import { useAllPrivateConversations, useAudienceConversationMessages } from '../hooks/useAudience';
import { Badge } from './ui/Badge';
import { Spinner } from './ui/Spinner';
import { Alert } from './ui/Alert';
import { Button } from './ui/Button';
import { MarkdownPreview } from './MarkdownPreview';
import CharacterAvatar from './CharacterAvatar';

interface AllPrivateMessagesViewProps {
  gameId: number;
}

/**
 * Read-only view of all private message conversations for audience members and GM
 * Features infinite scroll, participant filtering, and conversation browsing
 */
export function AllPrivateMessagesView({ gameId }: AllPrivateMessagesViewProps) {
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [selectedParticipants, setSelectedParticipants] = useState<Set<string>>(new Set());

  // Fetch messages for selected conversation
  const {
    data: messages,
    isLoading: messagesLoading,
    error: messagesError
  } = useAudienceConversationMessages(gameId, selectedConversationId);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    error,
  } = useAllPrivateConversations(gameId);

  // Infinite scroll handler
  useEffect(() => {
    const handleScroll = () => {
      if (
        window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 500 &&
        hasNextPage &&
        !isFetchingNextPage
      ) {
        fetchNextPage();
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Get all conversations and extract unique participants
  const allConversations = data?.pages.flatMap((page) => page.conversations || []) || [];
  const total = data?.pages[0]?.total || 0;

  // Extract unique participants across all conversations
  const allParticipants = useMemo(() => {
    const participantsSet = new Set<string>();
    allConversations.forEach((conv: any) => {
      (conv.participant_names || []).forEach((name: string) => {
        participantsSet.add(name);
      });
    });
    return Array.from(participantsSet).sort();
  }, [allConversations]);

  // Filter conversations based on selected participants
  const filteredConversations = useMemo(() => {
    if (selectedParticipants.size === 0) {
      return allConversations;
    }
    return allConversations.filter((conv: any) => {
      const convParticipants = conv.participant_names || [];
      // Show conversation if it includes any of the selected participants
      return convParticipants.some((name: string) => selectedParticipants.has(name));
    });
  }, [allConversations, selectedParticipants]);

  const toggleParticipant = (participant: string) => {
    setSelectedParticipants(prev => {
      const newSet = new Set(prev);
      if (newSet.has(participant)) {
        newSet.delete(participant);
      } else {
        newSet.add(participant);
      }
      return newSet;
    });
  };

  const clearFilters = () => {
    setSelectedParticipants(new Set());
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="danger">
        Failed to load private conversations: {(error as Error).message}
      </Alert>
    );
  }

  // If a conversation is selected, show the message viewer
  if (selectedConversationId) {
    return (
      <MessageViewer
        gameId={gameId}
        conversationId={selectedConversationId}
        messages={messages}
        isLoading={messagesLoading}
        error={messagesError}
        onBack={() => setSelectedConversationId(null)}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with Read-Only Badge */}
      {/* Mobile: Vertical stack */}
      <div className="md:hidden space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="text-lg font-semibold text-content-primary">
            All Private Messages
          </h2>
          <Badge variant="primary" size="sm">
            Read-Only
          </Badge>
        </div>
        <div className="text-sm text-content-secondary">
          {filteredConversations.length} of {total} conversation{total !== 1 ? 's' : ''}
        </div>
      </div>
      {/* Desktop: Horizontal layout */}
      <div className="hidden md:flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold text-content-primary">
            All Private Messages
          </h2>
          <Badge variant="primary" size="sm">
            Read-Only
          </Badge>
        </div>
        <div className="text-sm text-content-secondary">
          {filteredConversations.length} of {total} conversation{total !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Info Alert */}
      <Alert variant="info">
        As an audience member, you can view all private message conversations to follow the full story.
        You cannot send messages or participate in conversations.
      </Alert>

      {/* Participant Filter */}
      {allParticipants.length > 0 && (
        <div className="border border-border-primary rounded-lg p-4 bg-bg-secondary">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-content-primary">Filter by Participants</h3>
            {selectedParticipants.size > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="text-xs"
              >
                Clear filters
              </Button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {allParticipants.map((participant) => {
              const isSelected = selectedParticipants.has(participant);
              return (
                <button
                  key={participant}
                  onClick={() => toggleParticipant(participant)}
                  className={`
                    px-3 py-1.5 rounded-full text-sm font-medium transition-colors
                    ${isSelected
                      ? 'bg-interactive-primary text-white'
                      : 'bg-bg-primary border border-border-primary text-content-primary hover:bg-bg-tertiary'
                    }
                  `}
                >
                  {participant}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Conversations List */}
      {filteredConversations.length === 0 ? (
        <div className="text-center py-12 text-content-secondary">
          {selectedParticipants.size > 0 ? (
            <>
              <p className="text-lg mb-2">No conversations found</p>
              <p className="text-sm">Try adjusting your filters</p>
            </>
          ) : (
            <>
              <p className="text-lg mb-2">No private conversations yet</p>
              <p className="text-sm">Conversations will appear here once players start messaging</p>
            </>
          )}
        </div>
      ) : (
        <div className="border border-border-primary rounded-lg overflow-hidden divide-y divide-border-primary">
          {filteredConversations.map((conversation: any) => (
            <ConversationCard
              key={conversation.conversation_id}
              conversation={conversation}
              isSelected={selectedConversationId === conversation.conversation_id}
              onSelect={() => setSelectedConversationId(conversation.conversation_id)}
            />
          ))}

          {/* Load More Indicator */}
          {isFetchingNextPage && (
            <div className="flex justify-center py-4">
              <Spinner size="md" />
            </div>
          )}

          {!hasNextPage && filteredConversations.length > 0 && (
            <div className="text-center py-4 text-sm text-content-secondary">
              End of conversations
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Individual conversation card component - designed to match ConversationList style
 */
function ConversationCard({
  conversation,
  isSelected,
  onSelect,
}: {
  conversation: any;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const formatDate = (dateString: string) => {
    if (!dateString) return '';
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

  // Handle both array format (new) and individual fields format (old)
  const participantNames = conversation.participant_names || [
    conversation.from_character_name,
    conversation.to_character_name
  ].filter(Boolean);

  const participantUsernames = conversation.participant_usernames || [
    conversation.from_username,
    conversation.to_username
  ].filter(Boolean);

  return (
    <button
      onClick={onSelect}
      className={`
        w-full text-left p-3 md:p-4 transition-colors cursor-pointer
        ${isSelected ? 'bg-interactive-primary-subtle border-l-4 border-interactive-primary' : 'hover:bg-bg-tertiary'}
      `}
    >
      {/* Mobile: Vertical Stack Layout */}
      <div className="md:hidden space-y-2">
        {/* Participants */}
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-base text-content-primary truncate">
            {participantNames.join(' • ')}
          </h3>
          <Badge variant="neutral" size="sm" className="flex-shrink-0">
            {conversation.message_count}
          </Badge>
        </div>

        {/* Subject (if present) */}
        {conversation.subject && (
          <p className="text-sm text-content-primary italic truncate">
            "{conversation.subject}"
          </p>
        )}

        {/* Usernames + Timestamp */}
        <div className="flex items-center justify-between text-xs">
          <p className="text-content-secondary truncate">
            {participantUsernames.join(' • ')}
          </p>
          <span className="flex-shrink-0 text-content-tertiary ml-2">
            {formatDate(conversation.last_message_at || conversation.created_at)}
          </span>
        </div>
      </div>

      {/* Desktop: Horizontal Layout (Original) */}
      <div className="hidden md:flex items-start justify-between gap-4">
        {/* Main content */}
        <div className="flex-1 min-w-0">
          {/* Participants and message count */}
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-content-primary truncate">
              {participantNames.join(' • ')}
            </h3>
            <Badge variant="neutral" size="sm" className="flex-shrink-0">
              {conversation.message_count}
            </Badge>
          </div>

          {/* Subject (if present) */}
          {conversation.subject && (
            <p className="text-sm text-content-primary italic truncate mb-1">
              "{conversation.subject}"
            </p>
          )}

          {/* Usernames */}
          <p className="text-xs text-content-secondary truncate">
            {participantUsernames.join(' • ')}
          </p>
        </div>

        {/* Timestamp */}
        <div className="flex-shrink-0 text-xs text-content-tertiary">
          {formatDate(conversation.last_message_at || conversation.created_at)}
        </div>
      </div>
    </button>
  );
}

/**
 * Message viewer component - displays messages for a selected conversation
 */
function MessageViewer({
  gameId: _gameId,
  conversationId: _conversationId,
  messages,
  isLoading,
  error,
  onBack,
}: {
  gameId: number;
  conversationId: string;
  messages: any[] | undefined;
  isLoading: boolean;
  error: Error | null;
  onBack: () => void;
}) {
  const formatTimestamp = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  return (
    <div className="space-y-4">
      {/* Header with back button */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}>
          ← Back to conversations
        </Button>
        <Badge variant="primary" size="sm">
          Read-Only
        </Badge>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="flex justify-center items-center py-12">
          <Spinner size="lg" />
        </div>
      )}

      {/* Error state */}
      {error && (
        <Alert variant="danger">
          Failed to load messages: {error.message}
        </Alert>
      )}

      {/* Messages */}
      {!isLoading && !error && messages && (
        <div className="border border-border-primary rounded-lg bg-bg-primary">
          {messages.length === 0 ? (
            <div className="text-center py-12 text-content-secondary">
              <p className="text-lg mb-2">No messages yet</p>
              <p className="text-sm">This conversation has no messages</p>
            </div>
          ) : (
            <div className="divide-y divide-border-primary">
              {messages.map((message: any) => (
                <div key={message.id} className="p-4">
                  {/* Message header */}
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex items-center gap-3">
                      {/* Avatar */}
                      <CharacterAvatar
                        avatarUrl={message.sender_avatar_url}
                        characterName={message.sender_character_name || message.sender_username}
                        size="md"
                      />
                      {/* Sender info */}
                      <div>
                        <div className="font-semibold text-content-primary">
                          {message.sender_character_name || 'Unknown Character'}
                        </div>
                        <div className="text-xs text-content-secondary">
                          {message.sender_username}
                        </div>
                      </div>
                    </div>
                    {/* Timestamp */}
                    <div className="text-xs text-content-tertiary whitespace-nowrap">
                      {formatTimestamp(message.created_at)}
                    </div>
                  </div>

                  {/* Message content */}
                  <div className="prose prose-sm max-w-none">
                    <MarkdownPreview content={message.content} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
