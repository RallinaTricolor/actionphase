import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api';
import type { Character } from '../types/characters';
import { CreateCharacterModal } from './CreateCharacterModal';
import { CharacterSheet } from './CharacterSheet';
import { Modal } from './Modal';

interface CharactersListProps {
  gameId: number;
  userRole?: string; // 'gm', 'player', 'audience'
  currentUserId?: number;
  gameState?: string;
}

export function CharactersList({
  gameId,
  userRole = 'player',
  currentUserId,
  gameState = 'setup'
}: CharactersListProps) {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedCharacterId, setSelectedCharacterId] = useState<number | null>(null);
  const queryClient = useQueryClient();

  const { data: characters = [], isLoading } = useQuery({
    queryKey: ['gameCharacters', gameId],
    queryFn: () => apiClient.getGameCharacters(gameId).then(res => res.data),
    refetchInterval: 30000 // Refetch every 30 seconds
  });

  const approveCharacterMutation = useMutation({
    mutationFn: ({ characterId, status }: { characterId: number; status: 'approved' | 'rejected' }) =>
      apiClient.approveCharacter(characterId, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gameCharacters', gameId] });
    }
  });

  const handleApproveCharacter = (characterId: number, status: 'approved' | 'rejected') => {
    approveCharacterMutation.mutate({ characterId, status });
  };

  // Group characters by type
  const playerCharacters = characters.filter(char => char.character_type === 'player_character');
  const gmNPCs = characters.filter(char => char.character_type === 'npc_gm');
  const audienceNPCs = characters.filter(char => char.character_type === 'npc_audience');

  // Check if user can create characters
  const canCreateCharacter = () => {
    if (gameState === 'completed' || gameState === 'cancelled') return false;
    if (userRole === 'gm') return true;
    if (userRole === 'player' && (gameState === 'character_creation' || gameState === 'setup')) return true;
    return false;
  };

  // Check if character belongs to current user
  const isUserCharacter = (character: Character) => {
    return character.user_id === currentUserId;
  };

  // Check if user can view character sheet
  const canViewCharacterSheet = (character: Character) => {
    // GM can view all character sheets
    if (userRole === 'gm') return true;
    // Users can view their own characters
    if (isUserCharacter(character)) return true;
    // Public view for approved characters (for now, restrict to owner and GM)
    return false;
  };

  // Check if user can edit character sheet
  const canEditCharacterSheet = (character: Character) => {
    // GM can edit all character sheets
    if (userRole === 'gm') return true;
    // Users can edit their own characters if approved
    if (isUserCharacter(character) && character.status === 'approved') return true;
    return false;
  };

  // Get character status badge styles
  const getStatusBadge = (status: string) => {
    const baseClasses = "px-2 py-1 text-xs font-medium rounded-full";
    switch (status) {
      case 'approved':
        return `${baseClasses} bg-green-100 text-green-800`;
      case 'pending':
        return `${baseClasses} bg-yellow-100 text-yellow-800`;
      case 'rejected':
        return `${baseClasses} bg-red-100 text-red-800`;
      case 'active':
        return `${baseClasses} bg-blue-100 text-blue-800`;
      case 'dead':
        return `${baseClasses} bg-gray-100 text-gray-800`;
      default:
        return `${baseClasses} bg-gray-100 text-gray-800`;
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">Characters</h2>
        <div className="animate-pulse space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-200 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Characters</h2>
          {canCreateCharacter() && (
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Create Character
            </button>
          )}
        </div>

        {characters.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>No characters created yet.</p>
            {canCreateCharacter() && (
              <p className="mt-1 text-sm">Click "Create Character" to get started.</p>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {/* Player Characters */}
            {playerCharacters.length > 0 && (
              <div>
                <h3 className="text-md font-medium text-gray-700 mb-3">Player Characters</h3>
                <div className="space-y-3">
                  {playerCharacters.map((character) => (
                    <CharacterCard
                      key={character.id}
                      character={character}
                      isOwner={isUserCharacter(character)}
                      userRole={userRole}
                      onApprove={handleApproveCharacter}
                      getStatusBadge={getStatusBadge}
                      canViewSheet={canViewCharacterSheet(character)}
                      canEditSheet={canEditCharacterSheet(character)}
                      onViewSheet={() => setSelectedCharacterId(character.id)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* GM NPCs */}
            {gmNPCs.length > 0 && (
              <div>
                <h3 className="text-md font-medium text-gray-700 mb-3">GM NPCs</h3>
                <div className="space-y-3">
                  {gmNPCs.map((character) => (
                    <CharacterCard
                      key={character.id}
                      character={character}
                      isOwner={false}
                      userRole={userRole}
                      onApprove={handleApproveCharacter}
                      getStatusBadge={getStatusBadge}
                      canViewSheet={canViewCharacterSheet(character)}
                      canEditSheet={canEditCharacterSheet(character)}
                      onViewSheet={() => setSelectedCharacterId(character.id)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Audience NPCs */}
            {audienceNPCs.length > 0 && (
              <div>
                <h3 className="text-md font-medium text-gray-700 mb-3">Audience NPCs</h3>
                <div className="space-y-3">
                  {audienceNPCs.map((character) => (
                    <CharacterCard
                      key={character.id}
                      character={character}
                      isOwner={isUserCharacter(character)}
                      userRole={userRole}
                      onApprove={handleApproveCharacter}
                      getStatusBadge={getStatusBadge}
                      canViewSheet={canViewCharacterSheet(character)}
                      canEditSheet={canEditCharacterSheet(character)}
                      onViewSheet={() => setSelectedCharacterId(character.id)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <CreateCharacterModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        gameId={gameId}
        userRole={userRole}
      />

      {/* Character Sheet Modal */}
      {selectedCharacterId && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedCharacterId(null)}
          title=""
        >
          <CharacterSheet
            characterId={selectedCharacterId}
            canEdit={canEditCharacterSheet(characters.find(c => c.id === selectedCharacterId) || ({} as Character))}
            onClose={() => setSelectedCharacterId(null)}
          />
        </Modal>
      )}
    </div>
  );
}

interface CharacterCardProps {
  character: Character;
  isOwner: boolean;
  userRole: string;
  onApprove: (characterId: number, status: 'approved' | 'rejected') => void;
  getStatusBadge: (status: string) => string;
  canViewSheet: boolean;
  canEditSheet: boolean;
  onViewSheet: () => void;
}

function CharacterCard({
  character,
  isOwner,
  userRole,
  onApprove,
  getStatusBadge,
  canViewSheet,
  canEditSheet,
  onViewSheet
}: CharacterCardProps) {
  return (
    <div className="border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow">
      <div className="flex justify-between items-start">
        <div className="flex-grow">
          <div className="flex items-center space-x-2 mb-1">
            <h4 className="font-medium text-gray-900">{character.name}</h4>
            <span className={getStatusBadge(character.status)}>
              {character.status}
            </span>
            {isOwner && (
              <span className="px-2 py-1 text-xs font-medium bg-purple-100 text-purple-800 rounded-full">
                Your Character
              </span>
            )}
          </div>

          <div className="text-sm text-gray-600 space-y-1">
            <div>
              Type: <span className="capitalize">{character.character_type.replace('_', ' ')}</span>
            </div>
            {character.username && (
              <div>Player: {character.username}</div>
            )}
          </div>
        </div>

        <div className="flex flex-col space-y-2 ml-4">
          {/* View Character Sheet Button */}
          {canViewSheet && (
            <button
              onClick={onViewSheet}
              className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                canEditSheet
                  ? 'text-blue-700 bg-blue-100 hover:bg-blue-200 focus:ring-blue-500'
                  : 'text-gray-700 bg-gray-100 hover:bg-gray-200 focus:ring-gray-500'
              } focus:outline-none focus:ring-2`}
            >
              {canEditSheet ? 'Edit Sheet' : 'View Sheet'}
            </button>
          )}

          {/* GM Actions */}
          {userRole === 'gm' && character.status === 'pending' && (
            <div className="flex space-x-2">
              <button
                onClick={() => onApprove(character.id, 'approved')}
                className="px-2 py-1 text-xs font-medium text-green-700 bg-green-100 rounded hover:bg-green-200 focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                Approve
              </button>
              <button
                onClick={() => onApprove(character.id, 'rejected')}
                className="px-2 py-1 text-xs font-medium text-red-700 bg-red-100 rounded hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                Reject
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
