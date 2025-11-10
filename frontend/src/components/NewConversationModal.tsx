import { useState, useEffect } from 'react';
import { apiClient } from '../lib/api';
import type { Character } from '../types/characters';
import { Button, Input, Select, Checkbox, Alert } from './ui';
import { Modal } from './Modal';
import { logger } from '@/services/LoggingService';

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
  logger.debug('NewConversationModal state', {
    gameId,
    receivedCharactersCount: characters.length,
    allCharactersCount: allCharacters.length,
    availableParticipantsCount: allCharacters.filter(char => !characters.some(c => c.id === char.id)).length,
  });

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
      const response = await apiClient.characters.getGameCharacters(gameId);
      setAllCharacters(response.data);
    } catch (err) {
      logger.error('Failed to load characters', { error: err, gameId });
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

      const response = await apiClient.conversations.createConversation(gameId, {
        title: title.trim(),
        character_ids: allParticipantIds,
      });

      onConversationCreated(response.data.id);
      onClose();
    } catch (err) {
      logger.error('Failed to create conversation', { error: err, gameId, title, participantCount: selectedParticipants.size + 1 });
      setError(err instanceof Error ? err.message : 'Failed to create conversation');
    } finally {
      setCreating(false);
    }
  };

  // Get characters that are not controlled by the user (available as participants)
  // Exclude user's own characters (they can only send FROM one of their characters, not TO them)
  // Exclude pending/rejected characters from recipient selection for everyone (including GMs)
  // GMs can still see these characters in CharactersList for management purposes
  const availableParticipants = allCharacters.filter(
    char =>
      char.id !== yourCharacterId &&
      char.status !== 'pending' &&
      char.status !== 'rejected' &&
      !characters.some(c => c.id === char.id) // Exclude ALL user's controllable characters
  );

  return (
    <Modal isOpen={true} onClose={onClose} title="New Conversation">
      <div>
        {error && (
          <Alert variant="danger" className="mb-4">
            {error}
          </Alert>
        )}

        <div className="mb-4">
          <Input
            label="Conversation Title *"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Planning the heist"
            disabled={creating}
            required
          />
        </div>

        {/* Your Character Section */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-content-primary mb-2">
            Your Character
          </label>
          {characters.length === 0 ? (
            <p className="text-sm text-content-tertiary p-3 surface-raised rounded border border-theme-default">
              You need at least one character to create conversations
            </p>
          ) : characters.length === 1 ? (
            <div className="p-3 bg-interactive-primary-subtle border border-interactive-primary rounded">
              <div className="font-medium text-content-primary">{characters[0].name}</div>
              <div className="text-xs text-content-secondary">{characters[0].character_type.replace('_', ' ')}</div>
              {!isAnonymous && characters[0].username && (
                <div className="text-xs text-content-tertiary">Played by {characters[0].username}</div>
              )}
            </div>
          ) : (
            <Select
              value={yourCharacterId || ''}
              onChange={(e) => setYourCharacterId(Number(e.target.value))}
              disabled={creating}
            >
              <option value="">Select your character...</option>
              {characters.map((char) => (
                <option key={char.id} value={char.id}>
                  {char.name} ({char.character_type.replace('_', ' ')}){!isAnonymous && char.username ? ` - ${char.username}` : ''}
                </option>
              ))}
            </Select>
          )}
        </div>

        {/* Participants Section */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-content-primary mb-2">
            Participants (select at least 1)
          </label>
          <div className="space-y-2 max-h-60 overflow-y-auto border border-theme-default rounded-md p-2">
            {loadingCharacters ? (
              <p className="text-sm text-content-tertiary text-center py-4">
                Loading characters...
              </p>
            ) : availableParticipants.length === 0 ? (
              <p className="text-sm text-content-tertiary text-center py-4">
                No other characters available
              </p>
            ) : (
              availableParticipants.map((character) => (
                <label
                  key={character.id}
                  className={`flex items-start gap-3 p-2 rounded transition-colors cursor-pointer ${
                    selectedParticipants.has(character.id)
                      ? 'bg-interactive-primary-subtle border border-interactive-primary'
                      : 'hover:surface-raised border border-transparent'
                  }`}
                >
                  <Checkbox
                    id={`participant-${character.id}`}
                    checked={selectedParticipants.has(character.id)}
                    onChange={() => handleToggleParticipant(character.id)}
                    disabled={creating}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <div className="font-medium text-content-primary">{character.name}</div>
                    <div className="text-xs text-content-tertiary">{character.character_type.replace('_', ' ')}</div>
                    {!isAnonymous && character.username && (
                      <div className="text-xs text-content-tertiary">Played by {character.username}</div>
                    )}
                  </div>
                </label>
              ))
            )}
          </div>
          {selectedParticipants.size > 0 && (
            <p className="text-xs text-content-tertiary mt-2">
              {selectedParticipants.size} participant{selectedParticipants.size !== 1 ? 's' : ''} selected
            </p>
          )}
        </div>

        <div className="flex gap-3">
          <Button
            variant="ghost"
            onClick={onClose}
            disabled={creating}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleCreate}
            disabled={creating || !title.trim() || !yourCharacterId || selectedParticipants.size === 0 || loadingCharacters || characters.length === 0}
            className="flex-1"
          >
            {creating ? 'Creating...' : 'Create Conversation'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
