import { useState, useEffect, useCallback } from 'react';
import { RefreshCw } from 'lucide-react';
import { ConversationList } from './ConversationList';
import { MessageThread } from './MessageThread';
import { NewConversationModal } from './NewConversationModal';
import { apiClient } from '../lib/api';
import type { Character } from '../types/characters';
import type { ConversationListItem } from '../types/conversations';
import { Button, Alert } from './ui';
import { logger } from '@/services/LoggingService';

interface PrivateMessagesProps {
  gameId: number;
  characters: Character[];
  isAnonymous: boolean;
  currentPhaseType?: string; // Current game phase type (common_room, action, results, etc.)
}

/**
 * PrivateMessages - Full-screen messaging interface
 *
 * Uses a mobile-first full-screen pattern for all screen sizes:
 * - Conversation list OR message thread (not both simultaneously)
 * - Back button navigation from thread to list
 * - Maximum screen space for reading messages (primary use case)
 * - Consistent UX across mobile, tablet, and desktop
 *
 * Layout follows modern messaging apps (Slack, Discord, WhatsApp Web):
 * - List view: Full-width conversation cards
 * - Thread view: Full-screen messages with centered content on desktop
 */
export function PrivateMessages({ gameId, characters, isAnonymous, currentPhaseType }: PrivateMessagesProps) {
  const [selectedConversationId, setSelectedConversationId] = useState<number | null>(null);
  const [showNewConversationModal, setShowNewConversationModal] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [isRefreshingList, setIsRefreshingList] = useState(false);

  // Check if we're in a common room phase (when messaging is allowed)
  const isCommonRoomPhase = currentPhaseType === 'common_room';

  logger.debug('PrivateMessages component state', {
    selectedConversationId,
    charactersCount: characters.length,
    gameId,
    currentPhaseType,
    isCommonRoomPhase
  });

  const loadConversations = useCallback(async () => {
    try {
      const response = await apiClient.conversations.getUserConversations(gameId);
      // Deduplicate by ID
      const conversationMap = new Map<number, ConversationListItem>();
      (response.data.conversations || []).forEach(conv => {
        if (!conversationMap.has(conv.id)) {
          conversationMap.set(conv.id, conv);
        }
      });
      setConversations(Array.from(conversationMap.values()));
    } catch (_err) {
      logger.error('Failed to load conversations', { error: _err, gameId });
    }
  }, [gameId]);

  const handleRefreshConversations = useCallback(async () => {
    setIsRefreshingList(true);
    try {
      setRefreshKey(prev => prev + 1);  // Force ConversationList to remount and fetch fresh data
      await loadConversations();  // Update local state for read tracking
      logger.debug('Refreshed conversation list', { gameId });
    } finally {
      setIsRefreshingList(false);
    }
  }, [loadConversations, gameId]);

  // Load conversations for read tracking info
  useEffect(() => {
    loadConversations();
  }, [gameId, refreshKey, loadConversations]);

  const handleConversationCreated = (conversationId: number) => {
    logger.debug('Conversation created', { conversationId, gameId });
    setRefreshKey(prev => prev + 1);
    setSelectedConversationId(conversationId);
  };

  const handleSelectConversation = (conversationId: number) => {
    logger.debug('Conversation selected', { conversationId, gameId });
    setSelectedConversationId(conversationId);
  };

  const handleBackToList = () => {
    setSelectedConversationId(null);
  };

  // Get the selected conversation info for read tracking
  const selectedConversationInfo = selectedConversationId
    ? conversations.find(c => c.id === selectedConversationId)
    : undefined;

  return (
    <div className="h-full">
      {!selectedConversationId ? (
        /* Conversation List (full screen) */
        <div className="h-full flex flex-col surface-base">
          <div className="p-4 border-b border-theme-default surface-raised">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-bold text-content-primary">Private Messages</h2>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRefreshConversations}
                  disabled={isRefreshingList}
                  className="flex items-center gap-2"
                  aria-label="Refresh conversation list"
                >
                  <RefreshCw className={`w-4 h-4 ${isRefreshingList ? 'animate-spin' : ''}`} />
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setShowNewConversationModal(true)}
                  disabled={!isCommonRoomPhase}
                  title={!isCommonRoomPhase ? 'New conversations can only be started during Common Room phases' : 'Start a new private conversation'}
                >
                  + New
                </Button>
              </div>
            </div>
            {!isCommonRoomPhase && (
              <Alert variant="info" className="mt-2">
                You can read message history, but new messages can only be sent during Common Room phases.
              </Alert>
            )}
          </div>

          <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-border-primary scrollbar-track-transparent hover:scrollbar-thumb-border-secondary">
            <ConversationList
              key={refreshKey}
              gameId={gameId}
              onSelectConversation={handleSelectConversation}
              selectedConversationId={selectedConversationId || undefined}
            />
          </div>
        </div>
      ) : (
        /* Message Thread (full screen with centered content on desktop) */
        <div className="h-full flex flex-col surface-base">
          {/* Back button */}
          <div className="p-3 border-b border-theme-default surface-base sticky top-0 z-10">
            <div className="max-w-5xl mx-auto">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBackToList}
                className="flex items-center text-interactive-primary hover:text-interactive-primary-hover font-medium h-auto p-0"
              >
                <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to conversations
              </Button>
            </div>
          </div>

          {/* Thread - centered with max-width for better readability on desktop */}
          <div className="flex-1 overflow-hidden">
            <div className="h-full max-w-5xl mx-auto">
              <MessageThread
                gameId={gameId}
                conversationId={selectedConversationId}
                characters={characters}
                onMarkedAsRead={() => setRefreshKey(prev => prev + 1)}
                conversationInfo={selectedConversationInfo}
                currentPhaseType={currentPhaseType}
              />
            </div>
          </div>
        </div>
      )}

      {showNewConversationModal && (
        <NewConversationModal
          gameId={gameId}
          characters={characters}
          isAnonymous={isAnonymous}
          onClose={() => setShowNewConversationModal(false)}
          onConversationCreated={handleConversationCreated}
        />
      )}
    </div>
  );
}
