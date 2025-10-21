import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api';
import type { Character } from '../types/characters';
import { CreateCharacterModal } from './CreateCharacterModal';
import { CharacterSheet } from './CharacterSheet';
import { Modal } from './Modal';
import { Card, Button, Badge, Spinner, type BadgeVariant } from './ui';

interface CharactersListProps {
  gameId: number;
  userRole?: string; // 'gm', 'player', 'audience'
  currentUserId?: number;
  gameState?: string;
  isAnonymous?: boolean;
}

export function CharactersList({
  gameId,
  userRole = 'player',
  currentUserId,
  gameState = 'setup',
  isAnonymous = false
}: CharactersListProps) {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedCharacterId, setSelectedCharacterId] = useState<number | null>(null);
  const queryClient = useQueryClient();

  const { data: charactersData, isLoading } = useQuery({
    queryKey: ['gameCharacters', gameId],
    queryFn: () => apiClient.characters.getGameCharacters(gameId).then(res => res.data || []),
    refetchInterval: 30000 // Refetch every 30 seconds
  });

  // Ensure characters is always an array
  const characters = charactersData || [];

  const approveCharacterMutation = useMutation({
    mutationFn: ({ characterId, status }: { characterId: number; status: 'approved' | 'rejected' }) =>
      apiClient.characters.approveCharacter(characterId, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gameCharacters', gameId] });
    }
  });

  const handleApproveCharacter = (characterId: number, status: 'approved' | 'rejected') => {
    approveCharacterMutation.mutate({ characterId, status });
  };

  // Filter characters based on user role and status
  // GM sees all characters
  // Players see approved characters + their own characters (regardless of status)
  const visibleCharacters = userRole === 'gm'
    ? characters
    : characters.filter(char => char.status === 'approved' || char.user_id === currentUserId);

  // Group characters by type
  const playerCharacters = visibleCharacters.filter(char => char.character_type === 'player_character');
  const gmNPCs = visibleCharacters.filter(char => char.character_type === 'npc_gm');
  const audienceNPCs = visibleCharacters.filter(char => char.character_type === 'npc_audience');

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
    // Anyone can view approved characters (they'll only see public information)
    if (character.status === 'approved') return true;
    return false;
  };

  // Check if user can edit character sheet
  const canEditCharacterSheet = (character: Character) => {
    // GM can edit all character sheets
    if (userRole === 'gm') return true;
    // Users can edit their own characters (regardless of approval status)
    if (isUserCharacter(character)) return true;
    return false;
  };

  // Get character status badge variant
  const getStatusBadgeVariant = (status: string): BadgeVariant => {
    switch (status) {
      case 'approved':
        return 'success';
      case 'pending':
        return 'warning';
      case 'rejected':
        return 'danger';
      case 'active':
        return 'primary';
      case 'dead':
        return 'neutral';
      default:
        return 'neutral';
    }
  };

  if (isLoading) {
    return (
      <Card variant="elevated" padding="lg">
        <h2 className="text-lg font-semibold text-content-primary mb-4">Characters</h2>
        <div className="flex items-center justify-center py-8">
          <Spinner size="lg" label="Loading characters..." />
        </div>
      </Card>
    );
  }

  return (
    <Card variant="elevated" padding="lg">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-content-primary">Characters</h2>
        {canCreateCharacter() && (
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsCreateModalOpen(true)}
          >
            Create Character
          </Button>
        )}
      </div>

      {characters.length === 0 ? (
        <div className="text-center py-8 text-content-secondary">
          <p>No characters created yet.</p>
          {canCreateCharacter() && (
            <p className="mt-1 text-sm">Click "Create Character" to get started.</p>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Anonymous mode: Show all characters in one unified list */}
          {isAnonymous && userRole !== 'gm' ? (
              <div className="space-y-3">
                {visibleCharacters.map((character) => (
                  <CharacterCard
                    key={character.id}
                    character={character}
                    isOwner={isUserCharacter(character)}
                    userRole={userRole}
                    isAnonymous={isAnonymous}
                    onApprove={handleApproveCharacter}
                    getStatusBadgeVariant={getStatusBadgeVariant}
                    canViewSheet={canViewCharacterSheet(character)}
                    canEditSheet={canEditCharacterSheet(character)}
                    onViewSheet={() => setSelectedCharacterId(character.id)}
                  />
                ))}
              </div>
            ) : (
              <>
                {/* Non-anonymous mode: Show characters grouped by type */}
                {/* Player Characters */}
                {playerCharacters.length > 0 && (
                  <div>
                    <h3 className="text-md font-medium text-content-primary mb-3">Player Characters</h3>
                    <div className="space-y-3">
                      {playerCharacters.map((character) => (
                        <CharacterCard
                          key={character.id}
                          character={character}
                          isOwner={isUserCharacter(character)}
                          userRole={userRole}
                          isAnonymous={isAnonymous}
                          onApprove={handleApproveCharacter}
                          getStatusBadgeVariant={getStatusBadgeVariant}
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
                    <h3 className="text-md font-medium text-content-primary mb-3">GM NPCs</h3>
                    <div className="space-y-3">
                      {gmNPCs.map((character) => (
                        <CharacterCard
                          key={character.id}
                          character={character}
                          isOwner={isUserCharacter(character)}
                          userRole={userRole}
                          isAnonymous={isAnonymous}
                          onApprove={handleApproveCharacter}
                          getStatusBadgeVariant={getStatusBadgeVariant}
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
                    <h3 className="text-md font-medium text-content-primary mb-3">Audience NPCs</h3>
                    <div className="space-y-3">
                      {audienceNPCs.map((character) => (
                        <CharacterCard
                          key={character.id}
                          character={character}
                          isOwner={isUserCharacter(character)}
                          userRole={userRole}
                          isAnonymous={isAnonymous}
                          onApprove={handleApproveCharacter}
                          getStatusBadgeVariant={getStatusBadgeVariant}
                          canViewSheet={canViewCharacterSheet(character)}
                          canEditSheet={canEditCharacterSheet(character)}
                          onViewSheet={() => setSelectedCharacterId(character.id)}
                        />
                      ))}
                    </div>
                  </div>
                )}
            </>
          )}
        </div>
      )}

      <CreateCharacterModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        gameId={gameId}
        userRole={userRole}
      />

      {/* Character Sheet Modal */}
      {selectedCharacterId && (() => {
        const character = characters.find(c => c.id === selectedCharacterId);
        // Safety check: only show sheet if character exists
        if (!character) return null;

        return (
          <Modal
            isOpen={true}
            onClose={() => setSelectedCharacterId(null)}
            title=""
          >
            <CharacterSheet
              characterId={selectedCharacterId}
              canEdit={canEditCharacterSheet(character)}
              onClose={() => setSelectedCharacterId(null)}
            />
          </Modal>
        );
      })()}
    </Card>
  );
}

interface CharacterCardProps {
  character: Character;
  isOwner: boolean;
  userRole: string;
  isAnonymous?: boolean;
  onApprove: (characterId: number, status: 'approved' | 'rejected') => void;
  getStatusBadgeVariant: (status: string) => BadgeVariant;
  canViewSheet: boolean;
  canEditSheet: boolean;
  onViewSheet: () => void;
}

function CharacterCard({
  character,
  isOwner,
  userRole,
  isAnonymous = false,
  onApprove,
  getStatusBadgeVariant,
  canViewSheet,
  canEditSheet,
  onViewSheet
}: CharacterCardProps) {
  return (
    <div className="border border-theme-default rounded-lg p-4 surface-base hover:shadow-sm transition-shadow">
      <div className="flex justify-between items-start">
        <div className="flex-grow">
          <div className="flex items-center space-x-2 mb-1">
            <h4 className="font-medium text-content-primary">{character.name}</h4>
            <Badge variant={getStatusBadgeVariant(character.status)} size="sm">
              {character.status}
            </Badge>
            {/* Only show ownership badge if not anonymous or if GM */}
            {isOwner && (!isAnonymous || userRole === 'gm') && (
              <Badge variant="secondary" size="sm">
                Your Character
              </Badge>
            )}
          </div>

          <div className="text-sm text-content-primary space-y-1">
            {/* Only show character type if not anonymous or if GM */}
            {(!isAnonymous || userRole === 'gm') && (
              <div>
                Type: <span className="capitalize">{character.character_type.replace('_', ' ')}</span>
              </div>
            )}
            {/* Only show player name if not anonymous or if GM */}
            {character.username && (!isAnonymous || userRole === 'gm') && (
              <div>Player: {character.username}</div>
            )}
          </div>
        </div>

        <div className="flex flex-col space-y-2 ml-4">
          {/* View Character Sheet Button */}
          {canViewSheet && (
            <Button
              variant={canEditSheet ? 'primary' : 'secondary'}
              size="sm"
              onClick={onViewSheet}
            >
              {canEditSheet ? 'Edit Sheet' : 'View Sheet'}
            </Button>
          )}

          {/* GM Actions */}
          {userRole === 'gm' && character.status === 'pending' && (
            <div className="flex space-x-2">
              <Button
                variant="primary"
                size="sm"
                onClick={() => onApprove(character.id, 'approved')}
                className="bg-success hover:bg-success-hover"
              >
                Approve
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => onApprove(character.id, 'rejected')}
              >
                Reject
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
