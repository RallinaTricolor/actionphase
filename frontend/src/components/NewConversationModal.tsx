import { useState, useEffect } from 'react';
import { apiClient } from '../lib/api';
import type { Character } from '../types/characters';

interface NewConversationModalProps {
  gameId: number;
  characters: Character[]; // User's controllable characters
  isAnonymous: boolean;
  onClose: () => void;
  onConversationCreated: (conversationId: number) => void;
}

export function NewConversationModal({ gameId, characters, isAnonymous, onClose, onConversationCreated }: NewConversationModalProps) {
  const [allCharacters, setAllCharacters] = useState<Character[]>([]);
  const [loadingCharacters, setLoadingCharacters] = useState(true);
  const [title, setTitle] = useState('');
  const [yourCharacterId, setYourCharacterId] = useState<number | null>(null);
  const [selectedParticipants, setSelectedParticipants] = useState<Set<number>>(new Set());
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Debug logging
  console.log('[NewConversationModal] Received characters prop:', characters);
  console.log('[NewConversationModal] allCharacters state:', allCharacters);
  console.log('[NewConversationModal] availableParticipants:', allCharacters.filter(
    char => !characters.some(c => c.id === char.id)
  ));

  useEffect(() => {
    loadAllCharacters();
  }, [gameId]);

  useEffect(() => {
    // Auto-select if user only has one character
    if (characters.length === 1 && !yourCharacterId) {
      setYourCharacterId(characters[0].id);
    }
  }, [characters, yourCharacterId]);

  const loadAllCharacters = async () => {
    try {
      setLoadingCharacters(true);
      const response = await apiClient.getGameCharacters(gameId);
      setAllCharacters(response.data);
    } catch (err) {
      console.error('Failed to load characters:', err);
      setError('Failed to load characters');
    } finally {
      setLoadingCharacters(false);
    }
  };

  const handleToggleParticipant = (characterId: number) => {
    const newSelected = new Set(selectedParticipants);
    if (newSelected.has(characterId)) {
      newSelected.delete(characterId);
    } else {
      newSelected.add(characterId);
    }
    setSelectedParticipants(newSelected);
  };

  const handleCreate = async () => {
    if (!title.trim()) {
      setError('Please enter a conversation title');
      return;
    }

    if (!yourCharacterId) {
      setError('Please select your character');
      return;
    }

    if (selectedParticipants.size === 0) {
      setError('Please select at least one participant');
      return;
    }

    try {
      setCreating(true);
      setError(null);

      // Include your character + all selected participants
      const allParticipantIds = [yourCharacterId, ...Array.from(selectedParticipants)];

      const response = await apiClient.createConversation(gameId, {
        title: title.trim(),
        character_ids: allParticipantIds,
      });

      onConversationCreated(response.data.id);
      onClose();
    } catch (err) {
      console.error('Failed to create conversation:', err);
      setError(err instanceof Error ? err.message : 'Failed to create conversation');
    } finally {
      setCreating(false);
    }
  };

  // Get characters that are not controlled by the user (available as participants)
  const availableParticipants = allCharacters.filter(
    char => !characters.some(c => c.id === char.id)
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold">New Conversation</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
            {error}
          </div>
        )}

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Conversation Title <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Planning the heist"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={creating}
            required
          />
        </div>

        {/* Your Character Section */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Your Character
          </label>
          {characters.length === 0 ? (
            <p className="text-sm text-gray-500 p-3 bg-gray-50 rounded border border-gray-200">
              You need at least one character to create conversations
            </p>
          ) : characters.length === 1 ? (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded">
              <div className="font-medium text-gray-900">{characters[0].name}</div>
              <div className="text-xs text-gray-600">{characters[0].character_type.replace('_', ' ')}</div>
              {!isAnonymous && characters[0].username && (
                <div className="text-xs text-gray-500">Played by {characters[0].username}</div>
              )}
            </div>
          ) : (
            <select
              value={yourCharacterId || ''}
              onChange={(e) => setYourCharacterId(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={creating}
            >
              <option value="">Select your character...</option>
              {characters.map((char) => (
                <option key={char.id} value={char.id}>
                  {char.name} ({char.character_type.replace('_', ' ')}){!isAnonymous && char.username ? ` - ${char.username}` : ''}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Participants Section */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Participants (select at least 1)
          </label>
          <div className="space-y-2 max-h-60 overflow-y-auto border border-gray-200 rounded-md p-2">
            {loadingCharacters ? (
              <p className="text-sm text-gray-500 text-center py-4">
                Loading characters...
              </p>
            ) : availableParticipants.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">
                No other characters available
              </p>
            ) : (
              availableParticipants.map((character) => (
                <label
                  key={character.id}
                  className={`flex items-center p-2 rounded cursor-pointer transition-colors ${
                    selectedParticipants.has(character.id)
                      ? 'bg-blue-50 border border-blue-200'
                      : 'hover:bg-gray-50 border border-transparent'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedParticipants.has(character.id)}
                    onChange={() => handleToggleParticipant(character.id)}
                    className="mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    disabled={creating}
                  />
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">{character.name}</div>
                    <div className="text-xs text-gray-500">{character.character_type.replace('_', ' ')}</div>
                    {!isAnonymous && character.username && (
                      <div className="text-xs text-gray-400">Played by {character.username}</div>
                    )}
                  </div>
                </label>
              ))
            )}
          </div>
          {selectedParticipants.size > 0 && (
            <p className="text-xs text-gray-500 mt-2">
              {selectedParticipants.size} participant{selectedParticipants.size !== 1 ? 's' : ''} selected
            </p>
          )}
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={creating}
            className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={creating || !title.trim() || !yourCharacterId || selectedParticipants.size === 0 || loadingCharacters || characters.length === 0}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {creating ? 'Creating...' : 'Create Conversation'}
          </button>
        </div>
      </div>
    </div>
  );
}
