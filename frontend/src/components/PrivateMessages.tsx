import { useState } from 'react';
import { ConversationList } from './ConversationList';
import { MessageThread } from './MessageThread';
import { NewConversationModal } from './NewConversationModal';
import type { Character } from '../types/characters';

interface PrivateMessagesProps {
  gameId: number;
  characters: Character[];
  isAnonymous: boolean;
}

export function PrivateMessages({ gameId, characters, isAnonymous }: PrivateMessagesProps) {
  const [selectedConversationId, setSelectedConversationId] = useState<number | null>(null);
  const [showNewConversationModal, setShowNewConversationModal] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  console.log('[PrivateMessages] State:', { selectedConversationId, charactersCount: characters.length, gameId });

  const handleConversationCreated = (conversationId: number) => {
    console.log('[PrivateMessages] Conversation created:', conversationId);
    setRefreshKey(prev => prev + 1);
    setSelectedConversationId(conversationId);
  };

  const handleSelectConversation = (conversationId: number) => {
    console.log('[PrivateMessages] Conversation selected:', conversationId);
    setSelectedConversationId(conversationId);
  };

  return (
    <div className="h-full flex">
      {/* Conversation List Sidebar */}
      <div className="w-80 border-r border-gray-200 bg-white flex flex-col">
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-bold text-gray-900">Private Messages</h2>
            <button
              onClick={() => setShowNewConversationModal(true)}
              className="px-3 py-1 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
              title="New Conversation"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
          <p className="text-sm text-gray-600">
            Character-to-character conversations
          </p>
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

      {/* Message Thread */}
      <div className="flex-1 bg-white">
        {selectedConversationId ? (
          <MessageThread
            gameId={gameId}
            conversationId={selectedConversationId}
            characters={characters}
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-gray-500">
              <svg className="w-20 h-20 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <p className="text-lg mb-2">No conversation selected</p>
              <p className="text-sm">Select a conversation from the list or start a new one</p>
            </div>
          </div>
        )}
      </div>

      {/* New Conversation Modal */}
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
