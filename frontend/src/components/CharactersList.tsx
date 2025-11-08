import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api';
import type { Character } from '../types/characters';
import { CreateCharacterModal } from './CreateCharacterModal';
import { CharacterSheet } from './CharacterSheet';
import { AssignNPCModal } from './AssignNPCModal';
import { Modal } from './Modal';
import { Card, Button, Badge, Spinner, type BadgeVariant } from './ui';
import CharacterAvatar from './CharacterAvatar';
import { logger } from '@/services/LoggingService';

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
  const [npcToAssign, setNpcToAssign] = useState<Character | null>(null);
  const [characterToDelete, setCharacterToDelete] = useState<Character | null>(null);
  const queryClient = useQueryClient();

  const { data: charactersData, isLoading } = useQuery({
    queryKey: ['gameCharacters', gameId],
    queryFn: () => apiClient.characters.getGameCharacters(gameId).then(res => res.data || []),
    refetchInterval: 30000 // Refetch every 30 seconds
  });

  // Fetch game participants for user assignment (when GM creates player characters)
  const { data: participantsData } = useQuery({
    queryKey: ['gameParticipants', gameId],
    queryFn: () => apiClient.games.getGameParticipants(gameId).then(res => res.data || []),
    enabled: userRole === 'gm' // Only fetch for GMs
  });

  // Ensure characters is always an array
  const characters = charactersData || [];
  const participants = participantsData || [];

  const approveCharacterMutation = useMutation({
    mutationFn: ({ characterId, status }: { characterId: number; status: 'approved' | 'rejected' }) =>
      apiClient.characters.approveCharacter(characterId, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gameCharacters', gameId] });
    }
  });

  const deleteCharacterMutation = useMutation({
    mutationFn: (characterId: number) => apiClient.characters.deleteCharacter(characterId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gameCharacters', gameId] });
      setCharacterToDelete(null);
    },
    onError: (error: any) => {
      // Error will be displayed in the confirmation modal
      logger.error('Failed to delete character', { error, gameId, characterId: characterToDelete?.id, characterName: characterToDelete?.name });
    }
  });

  const handleApproveCharacter = (characterId: number, status: 'approved' | 'rejected') => {
    approveCharacterMutation.mutate({ characterId, status });
  };

  const handleDeleteCharacter = () => {
    if (characterToDelete) {
      deleteCharacterMutation.mutate(characterToDelete.id);
    }
  };

  // Filter characters based on user role, game state, and status
  // GM sees all characters
  // Players see approved characters + their own characters (with restrictions)
  // Once game is in_progress, players can't see/use pending characters at all
  const visibleCharacters = userRole === 'gm'
    ? characters
    : characters.filter(char => {
        // If game is in_progress, exclude pending/rejected characters for players
        if (gameState === 'in_progress' && (char.status === 'pending' || char.status === 'rejected')) {
          return false;
        }
        // Otherwise, show approved characters + their own characters
        return char.status === 'approved' || char.user_id === currentUserId;
      });

  // Group characters by type
  const playerCharacters = visibleCharacters.filter(char => char.character_type === 'player_character');
  const npcs = visibleCharacters.filter(char => char.character_type === 'npc');

  // Check if user can create characters
  const canCreateCharacter = () => {
    if (gameState === 'completed' || gameState === 'cancelled') return false;
    if (userRole === 'gm') return true;
    if (userRole === 'player' && (gameState === 'character_creation' || gameState === 'setup')) return true;
    return false;
  };

  // Check if character belongs to current user
  const isUserCharacter = (character: Character) => {
    if (character.character_type === 'player_character') {
      return character.user_id === currentUserId;
    }
    // For NPCs: GM owns all unassigned NPCs, or users own NPCs assigned to them
    if (character.character_type === 'npc') {
      // If NPC is assigned to someone, check if it's assigned to current user
      if (character.assigned_user_id) {
        return character.assigned_user_id === currentUserId;
      }
      // If NPC is unassigned, GM owns it
      return userRole === 'gm';
    }
    return false;
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

  // Check if user can edit character sheet (bio/notes fields)
  const canEditCharacterSheet = (character: Character) => {
    // GM can edit all character sheets
    if (userRole === 'gm') return true;
    // Users can edit their own characters (regardless of approval status)
    if (isUserCharacter(character)) return true;
    return false;
  };

  // Check if user can edit character stats (abilities, skills, items, currency)
  // This is GM-only functionality
  const canEditCharacterStats = () => {
    return userRole === 'gm';
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
    <Card variant="elevated" padding="lg" data-testid="characters-list">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-content-primary">Characters</h2>
        {canCreateCharacter() && (
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsCreateModalOpen(true)}
            data-testid="create-character-button"
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
                    onAssignNPC={setNpcToAssign}
                    onDelete={setCharacterToDelete}
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
                          onAssignNPC={setNpcToAssign}
                          onDelete={setCharacterToDelete}
                          getStatusBadgeVariant={getStatusBadgeVariant}
                          canViewSheet={canViewCharacterSheet(character)}
                          canEditSheet={canEditCharacterSheet(character)}
                          onViewSheet={() => setSelectedCharacterId(character.id)}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* NPCs */}
                {npcs.length > 0 && (
                  <div>
                    <h3 className="text-md font-medium text-content-primary mb-3">NPCs</h3>
                    <div className="space-y-3">
                      {npcs.map((character) => (
                        <CharacterCard
                          key={character.id}
                          character={character}
                          isOwner={isUserCharacter(character)}
                          userRole={userRole}
                          isAnonymous={isAnonymous}
                          onApprove={handleApproveCharacter}
                          onAssignNPC={setNpcToAssign}
                          onDelete={setCharacterToDelete}
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
        participants={participants}
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
              canEditStats={canEditCharacterStats()}
              onClose={() => setSelectedCharacterId(null)}
            />
          </Modal>
        );
      })()}

      {/* Assign NPC Modal */}
      {npcToAssign && (
        <AssignNPCModal
          character={npcToAssign}
          gameId={gameId}
          isOpen={true}
          onClose={() => setNpcToAssign(null)}
          onSuccess={() => {
            setNpcToAssign(null);
            queryClient.invalidateQueries({ queryKey: ['gameCharacters', gameId] });
          }}
        />
      )}

      {/* Delete Character Confirmation Modal */}
      {characterToDelete && (
        <Modal
          isOpen={true}
          onClose={() => setCharacterToDelete(null)}
          title="Delete Character?"
        >
          <div className="space-y-4">
            <p className="text-content-primary">
              Are you sure you want to delete <strong>{characterToDelete.name}</strong>?
            </p>
            <p className="text-sm text-content-secondary">
              This action cannot be undone. Characters with existing messages or action submissions cannot be deleted.
            </p>

            {deleteCharacterMutation.isError && (
              <div className="p-3 bg-danger/10 border border-danger rounded-md">
                <p className="text-sm text-danger">
                  {(deleteCharacterMutation.error as any)?.response?.data?.error ||
                   'Failed to delete character. The character may have existing activity.'}
                </p>
              </div>
            )}

            <div className="flex justify-end space-x-2">
              <Button
                variant="secondary"
                onClick={() => setCharacterToDelete(null)}
                disabled={deleteCharacterMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={handleDeleteCharacter}
                loading={deleteCharacterMutation.isPending}
                data-testid="confirm-delete-character-button"
              >
                Delete Character
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </Card>
  );
}

// Helper to determine if user can see player names in anonymous mode
// GMs, co-GMs, and audience can always see player names
// Only players have names hidden from them in anonymous mode
const canSeePlayerNames = (isAnonymous: boolean, userRole: string): boolean => {
  if (!isAnonymous) return true;
  return userRole === 'gm' || userRole === 'co_gm' || userRole === 'audience';
};

interface CharacterCardProps {
  character: Character;
  isOwner: boolean;
  userRole: string;
  isAnonymous?: boolean;
  onApprove: (characterId: number, status: 'approved' | 'rejected') => void;
  onAssignNPC?: (character: Character) => void;
  onDelete?: (character: Character) => void;
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
  onAssignNPC,
  onDelete,
  getStatusBadgeVariant,
  canViewSheet,
  canEditSheet,
  onViewSheet
}: CharacterCardProps) {
  return (
    <div className="border border-theme-default rounded-lg p-3 md:p-4 surface-base hover:shadow-sm transition-shadow" data-testid="character-card">
      {/* Mobile: Vertical Stack Layout */}
      <div className="md:hidden space-y-3">
        {/* Avatar + Name + Badges */}
        <div className="flex gap-3">
          <CharacterAvatar
            avatarUrl={character.avatar_url}
            characterName={character.name}
            size="md"
          />
          <div className="flex-grow min-w-0">
            <h4 className="font-semibold text-base text-content-primary mb-1.5" data-testid="character-name">
              {character.name}
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {character.status !== 'approved' && (
                <Badge variant={getStatusBadgeVariant(character.status)} size="sm">
                  <span data-testid="character-status-badge">{character.status}</span>
                </Badge>
              )}
              {isOwner && canSeePlayerNames(isAnonymous || false, userRole) && (
                <Badge variant="secondary" size="sm">
                  Your Character
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Character Info */}
        <div className="text-sm text-content-primary space-y-1">
          {canSeePlayerNames(isAnonymous || false, userRole) && (
            <div>
              Type: <span className="capitalize">{character.character_type.replace('_', ' ')}</span>
            </div>
          )}
          {character.character_type === 'npc' && character.assigned_username && canSeePlayerNames(isAnonymous || false, userRole) && (
            <div>Assigned to: {character.assigned_username}</div>
          )}
          {character.character_type === 'player_character' && character.username && canSeePlayerNames(isAnonymous || false, userRole) && (
            <div>Player: {character.username}</div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2 pt-2">
          {canViewSheet && (
            <Button
              variant={canEditSheet ? 'primary' : 'secondary'}
              size="sm"
              onClick={onViewSheet}
            >
              <span data-testid="edit-character-button">{canEditSheet ? 'Edit Sheet' : 'View Sheet'}</span>
            </Button>
          )}

          {userRole === 'gm' && character.character_type === 'npc' && onAssignNPC && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onAssignNPC(character)}
            >
              Assign NPC
            </Button>
          )}

          {userRole === 'gm' && character.status === 'pending' && (
            <Button
              variant="success"
              size="sm"
              onClick={() => onApprove(character.id, 'approved')}
            >
              <span data-testid="approve-character-button">Publish</span>
            </Button>
          )}

          {userRole === 'gm' && onDelete && (
            <Button
              variant="danger"
              size="sm"
              onClick={() => onDelete(character)}
            >
              <span data-testid="delete-character-button">Delete</span>
            </Button>
          )}
        </div>
      </div>

      {/* Desktop: Horizontal Layout (Original) */}
      <div className="hidden md:flex justify-between items-start">
        <div className="flex gap-3 flex-grow">
          <CharacterAvatar
            avatarUrl={character.avatar_url}
            characterName={character.name}
            size="md"
          />
          <div className="flex-grow">
            <div className="flex items-center space-x-2 mb-1">
              <h4 className="font-medium text-content-primary" data-testid="character-name">{character.name}</h4>
              {character.status !== 'approved' && (
                <Badge variant={getStatusBadgeVariant(character.status)} size="sm">
                  <span data-testid="character-status-badge">{character.status}</span>
                </Badge>
              )}
              {/* Show ownership badge if not anonymous mode OR if user can see player names (GM/co-GM/audience) */}
              {isOwner && canSeePlayerNames(isAnonymous || false, userRole) && (
                <Badge variant="secondary" size="sm">
                  Your Character
                </Badge>
              )}
            </div>

            <div className="text-sm text-content-primary space-y-1">
              {/* Show character type if not anonymous mode OR if user can see player names (GM/co-GM/audience) */}
              {canSeePlayerNames(isAnonymous || false, userRole) && (
                <div>
                  Type: <span className="capitalize">{character.character_type.replace('_', ' ')}</span>
                </div>
              )}
              {/* For NPCs, show assignment info */}
              {character.character_type === 'npc' && character.assigned_username && canSeePlayerNames(isAnonymous || false, userRole) && (
                <div>Assigned to: {character.assigned_username}</div>
              )}
              {/* For player characters, show player name if not anonymous mode OR if user can see player names (GM/co-GM/audience) */}
              {character.character_type === 'player_character' && character.username && canSeePlayerNames(isAnonymous || false, userRole) && (
                <div>Player: {character.username}</div>
              )}
            </div>
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
              <span data-testid="edit-character-button">{canEditSheet ? 'Edit Sheet' : 'View Sheet'}</span>
            </Button>
          )}

          {/* Assign NPC Button (GM only, for NPCs) */}
          {userRole === 'gm' && character.character_type === 'npc' && onAssignNPC && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onAssignNPC(character)}
            >
              Assign NPC
            </Button>
          )}

          {/* GM Actions */}
          {userRole === 'gm' && character.status === 'pending' && (
            <Button
              variant="success"
              size="sm"
              onClick={() => onApprove(character.id, 'approved')}
            >
              <span data-testid="approve-character-button">Publish</span>
            </Button>
          )}

          {/* Delete Character Button (GM only) */}
          {userRole === 'gm' && onDelete && (
            <Button
              variant="danger"
              size="sm"
              onClick={() => onDelete(character)}
            >
              <span data-testid="delete-character-button">Delete</span>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
