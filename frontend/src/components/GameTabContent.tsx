import { useState } from 'react';
import { GameApplicationsList } from './GameApplicationsList';
import { CharactersList } from './CharactersList';
import { PhaseManagement } from './PhaseManagement';
import { ActionSubmission } from './ActionSubmission';
import { ActionsList } from './ActionsList';
import { ActionResultsList } from './ActionResultsList';
import { CommonRoom } from './CommonRoom';
import { PrivateMessages } from './PrivateMessages';
import { PhaseHistoryView } from './PhaseHistoryView';
import { RemovePlayerButton } from './RemovePlayerButton';
import { AddPlayerModal } from './AddPlayerModal';
import { InactiveCharactersList } from './InactiveCharactersList';
import { Button } from './ui';
import type { Game, Participant, Character } from '../types/games';
import type { GamePhase } from '../types/phases';

interface GameTabContentProps {
  activeTab: string;
  gameId: number;
  game: Game;
  participants: Participant[];
  currentPhaseData?: { phase: GamePhase };
  isGM: boolean;
  isParticipant: boolean;
  currentUserId: number | null;
  userCharacters: Character[];
}

const formatDate = (dateString?: string) => {
  if (!dateString) return 'Not set';
  return new Date(dateString).toLocaleString();
};

export function GameTabContent({
  activeTab,
  gameId,
  game,
  participants,
  currentPhaseData,
  isGM,
  isParticipant,
  currentUserId,
  userCharacters,
}: GameTabContentProps) {
  const [showAddPlayerModal, setShowAddPlayerModal] = useState(false);

  // Applications Tab (Recruitment - GM only)
  if (activeTab === 'applications' && game.state === 'recruitment' && isGM) {
    return <GameApplicationsList gameId={gameId} isGM={isGM} gameState={game.state} />;
  }

  // Applications Tab (Character Creation - GM only, collapsed)
  if (activeTab === 'applications' && game.state === 'character_creation' && isGM) {
    return <GameApplicationsList gameId={gameId} isGM={isGM} gameState={game.state} />;
  }

  // Participants Tab
  if (activeTab === 'participants') {
    return (
      <>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-content-primary">Participants</h2>
          {isGM && (
            <Button
              variant="primary"
              onClick={() => setShowAddPlayerModal(true)}
            >
              Add Player
            </Button>
          )}
        </div>

        {participants.length === 0 ? (
          <p className="text-content-tertiary">No participants yet.</p>
        ) : (
          <div className="space-y-4">
            {['player', 'co_gm', 'audience'].map((role) => {
              const roleParticipants = participants.filter(p => p.role === role);
              if (roleParticipants.length === 0) return null;
              return (
                <div key={role}>
                  <h3 className="font-semibold text-content-primary mb-2 capitalize">
                    {role.replace('_', ' ')}s ({roleParticipants.length})
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {roleParticipants.map((participant) => (
                      <div key={participant.id} className="border border-theme-default rounded-lg p-4 surface-raised">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <div className="font-medium text-content-primary">{participant.username}</div>
                            <div className="text-sm text-content-tertiary">
                              Joined {new Date(participant.joined_at).toLocaleDateString()}
                            </div>
                          </div>
                          {isGM && participant.user_id !== currentUserId && (
                            <RemovePlayerButton
                              gameId={gameId}
                              participant={participant}
                            />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {isGM && (
          <div className="mt-8">
            <InactiveCharactersList gameId={gameId} />
          </div>
        )}

        <AddPlayerModal
          gameId={gameId}
          isOpen={showAddPlayerModal}
          onClose={() => setShowAddPlayerModal(false)}
        />
      </>
    );
  }

  // Game Info Tab (Recruitment & other states)
  if (activeTab === 'info') {
    return (
      <>
        <h2 className="text-2xl font-bold text-content-primary mb-6">Game Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="font-semibold text-content-primary mb-2">Genre</h3>
            <p className="text-content-secondary">{game.genre || 'Not specified'}</p>
          </div>
          <div>
            <h3 className="font-semibold text-content-primary mb-2">Players</h3>
            <p className="text-content-secondary">
              {game.current_players} / {game.max_players || 'Unlimited'}
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-content-primary mb-2">Recruitment Deadline</h3>
            <p className="text-content-secondary">{formatDate(game.recruitment_deadline)}</p>
          </div>
          <div>
            <h3 className="font-semibold text-content-primary mb-2">Start Date</h3>
            <p className="text-content-secondary">{formatDate(game.start_date)}</p>
          </div>
          <div>
            <h3 className="font-semibold text-content-primary mb-2">End Date</h3>
            <p className="text-content-secondary">{formatDate(game.end_date)}</p>
          </div>
        </div>
      </>
    );
  }

  // Characters Tab
  if (activeTab === 'characters') {
    return (
      <CharactersList
        gameId={gameId}
        userRole={isGM ? 'gm' : (isParticipant ? 'player' : 'audience')}
        currentUserId={currentUserId || undefined}
        gameState={game.state}
        isAnonymous={game.is_anonymous || false}
      />
    );
  }

  // Common Room Tab (In Progress - common_room phases)
  if (activeTab === 'common-room' && game.state === 'in_progress' && currentPhaseData?.phase?.phase_type === 'common_room') {
    return (
      <CommonRoom
        gameId={gameId}
        phaseId={currentPhaseData?.phase?.id}
        phaseTitle={currentPhaseData?.phase?.title || `Phase ${currentPhaseData?.phase?.phase_number}`}
        isCurrentPhase={true}
        isGM={isGM}
      />
    );
  }

  // Phases Tab (In Progress - GM only)
  if (activeTab === 'phases' && game.state === 'in_progress' && isGM) {
    return <PhaseManagement gameId={gameId} />;
  }

  // Actions Tab (In Progress)
  if (activeTab === 'actions' && game.state === 'in_progress') {
    return (
      <>
        {isGM ? (
          <ActionsList
            gameId={gameId}
            currentPhase={currentPhaseData?.phase}
          />
        ) : (
          <>
            <div className="mb-6">
              <ActionSubmission
                gameId={gameId}
                currentPhase={currentPhaseData?.phase}
              />
            </div>
            <div className="mb-6">
              <ActionResultsList gameId={gameId} />
            </div>
          </>
        )}
      </>
    );
  }

  // Phase History Tab (In Progress)
  if (activeTab === 'phase-history' && game.state === 'in_progress') {
    return <PhaseHistoryView gameId={gameId} currentPhaseId={currentPhaseData?.phase?.id} isGM={isGM} />;
  }

  // Private Messages Tab (In Progress)
  if (activeTab === 'messages' && game.state === 'in_progress') {
    return (
      <div className="h-[600px]">
        <PrivateMessages
          gameId={gameId}
          characters={userCharacters}
          isAnonymous={game.is_anonymous || false}
        />
      </div>
    );
  }

  // Default fallback
  return null;
}
