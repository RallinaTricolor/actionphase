import { useState, useEffect } from 'react';
import { ConversationList } from './ConversationList';
import { MessageThread } from './MessageThread';
import { NewConversationModal } from './NewConversationModal';
import { usePrivateMessagesLayout } from '../hooks/usePrivateMessagesLayout';
import { apiClient } from '../lib/api';
import type { Character } from '../types/characters';
import type { ConversationListItem } from '../types/conversations';
import { Button } from './ui';

interface PrivateMessagesProps {
  gameId: number;
  characters: Character[];
  isAnonymous: boolean;
}

export function PrivateMessages({ gameId, characters, isAnonymous }: PrivateMessagesProps) {
  const [selectedConversationId, setSelectedConversationId] = useState<number | null>(null);
  const [showNewConversationModal, setShowNewConversationModal] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [conversations, setConversations] = useState<ConversationListItem[]>([]);

  const {
    sidebarCollapsed,
    sidebarWidth,
    toggleSidebar,
  } = usePrivateMessagesLayout();

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  console.log('[PrivateMessages] State:', { selectedConversationId, charactersCount: characters.length, gameId });

  // Load conversations for read tracking info
  useEffect(() => {
    loadConversations();
  }, [gameId, refreshKey]);

  const loadConversations = async () => {
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
    } catch (err) {
      console.error('Failed to load conversations:', err);
    }
  };

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleConversationCreated = (conversationId: number) => {
    console.log('[PrivateMessages] Conversation created:', conversationId);
    setRefreshKey(prev => prev + 1);
    setSelectedConversationId(conversationId);
  };

  const handleSelectConversation = (conversationId: number) => {
    console.log('[PrivateMessages] Conversation selected:', conversationId);
    setSelectedConversationId(conversationId);
  };

  const handleBackToList = () => {
    setSelectedConversationId(null);
  };

  // Get the selected conversation info for read tracking
  const selectedConversationInfo = selectedConversationId
    ? conversations.find(c => c.id === selectedConversationId)
    : undefined;

  // Mobile view: show either list or thread
  if (isMobile) {
    return (
      <div className="h-full">
        {!selectedConversationId ? (
          /* Conversation List (full screen on mobile) */
          <div className="h-full flex flex-col surface-base">
            <div className="p-4 border-b border-theme-default surface-raised">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-lg font-bold text-content-primary">Private Messages</h2>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setShowNewConversationModal(true)}
                >
                  + New
                </Button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              <ConversationList
                key={refreshKey}
                gameId={gameId}
                onSelectConversation={handleSelectConversation}
                selectedConversationId={selectedConversationId || undefined}
              />
            </div>
          </div>
        ) : (
          /* Message Thread (full screen on mobile) */
          <div className="h-full flex flex-col surface-base">
            {/* Back button */}
            <div className="p-3 border-b border-theme-default surface-base sticky top-0 z-10">
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

            <div className="flex-1 overflow-hidden">
              <MessageThread
                gameId={gameId}
                conversationId={selectedConversationId}
                characters={characters}
                onMarkedAsRead={() => setRefreshKey(prev => prev + 1)}
                conversationInfo={selectedConversationInfo}
              />
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

  // Desktop view: sidebar + thread
  return (
    <div className="h-full flex">
      {/* Conversation List Sidebar */}
      <div
        className={`
          border-r border-theme-default surface-base flex flex-col transition-all duration-300
          ${sidebarCollapsed ? 'w-16' : ''}
        `}
        style={!sidebarCollapsed ? { width: `${sidebarWidth}px` } : undefined}
      >
        <div className="p-4 border-b border-theme-default surface-raised flex items-center justify-between">
          {!sidebarCollapsed && (
            <>
              <div>
                <h2 className="text-lg font-bold text-content-primary">Messages</h2>
                <p className="text-xs text-content-secondary">Private conversations</p>
              </div>
              <Button
                variant="primary"
                size="sm"
                onClick={() => setShowNewConversationModal(true)}
                title="New Conversation"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </Button>
            </>
          )}

          {/* Toggle Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleSidebar}
            className="p-2 hover:surface-raised rounded-md"
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <svg className="w-5 h-5 text-content-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d={sidebarCollapsed ? "M13 5l7 7-7 7M5 5l7 7-7 7" : "M11 19l-7-7 7-7m8 14l-7-7 7-7"}
              />
            </svg>
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <ConversationList
            key={refreshKey}
            gameId={gameId}
            onSelectConversation={handleSelectConversation}
            selectedConversationId={selectedConversationId || undefined}
            collapsed={sidebarCollapsed}
          />
        </div>
      </div>

      {/* Message Thread */}
      <div className="flex-1 surface-base">
        {selectedConversationId ? (
          <MessageThread
            gameId={gameId}
            conversationId={selectedConversationId}
            characters={characters}
            onMarkedAsRead={() => setRefreshKey(prev => prev + 1)}
            conversationInfo={selectedConversationInfo}
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-content-secondary">
              <svg className="w-20 h-20 mx-auto mb-4 text-content-tertiary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <p className="text-lg mb-2">No conversation selected</p>
              <p className="text-sm">Select a conversation or start a new one</p>
            </div>
          </div>
        )}
      </div>

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
