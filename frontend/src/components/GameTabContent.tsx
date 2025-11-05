import { useState } from 'react';
import type { Character } from '../types/characters';
import { GameApplicationsList } from './GameApplicationsList';
import { PublicApplicantsList } from './PublicApplicantsList';
import { CharactersList } from './CharactersList';
import { PhaseManagement } from './PhaseManagement';
import { ActionSubmission } from './ActionSubmission';
import { ActionsList } from './ActionsList';
import { ActionResultsList } from './ActionResultsList';
import { GameResultsManager } from './GameResultsManager';
import { CommonRoom } from './CommonRoom';
import { PrivateMessages } from './PrivateMessages';
import { HistoryView } from './HistoryView';
import { RemovePlayerButton } from './RemovePlayerButton';
import { AddPlayerModal } from './AddPlayerModal';
import { InactiveCharactersList } from './InactiveCharactersList';
import { AudienceView } from './AudienceView';
import { AudienceMemberBadge } from './AudienceMemberBadge';
import { PeopleView } from './PeopleView';
import { HandoutsList } from './HandoutsList';
import { DeadlinesTabContent } from './DeadlinesTabContent';
import { Button } from './ui';
import type { GameWithDetails, GameParticipant } from '../types/games';
import type { GamePhase } from '../types/phases';

interface GameTabContentProps {
  activeTab: string;
  gameId: number;
  game: GameWithDetails;
  participants: GameParticipant[];
  currentPhaseData?: { phase: GamePhase | null };
  isLoadingPhase?: boolean;
  isGM: boolean;
  isParticipant: boolean;
  currentUserId: number | null;
  userCharacters: Character[];
  onLeaveGame?: () => void;
  actionLoading?: boolean;
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
  isLoadingPhase = false,
  isGM,
  isParticipant,
  currentUserId,
  userCharacters,
  onLeaveGame,
  actionLoading = false,
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

  // People Tab (combines Characters and GameParticipants)
  if (activeTab === 'people') {
    return (
      <PeopleView
        gameId={gameId}
        participants={participants}
        isGM={isGM}
        currentUserId={currentUserId}
        gmUserId={game.gm_user_id}
        gameState={game.state}
        isAnonymous={game.is_anonymous || false}
        onLeaveGame={onLeaveGame}
        actionLoading={actionLoading}
      />
    );
  }

  // GameParticipants Tab (for other game states)
  if (activeTab === 'participants') {
    return (
      <>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-content-primary">GameParticipants</h2>
          {isGM && game.state !== 'completed' && game.state !== 'cancelled' && (
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
              const roleGameParticipants = participants.filter(p => p.role === role);
              if (roleGameParticipants.length === 0) return null;
              return (
                <div key={role}>
                  <h3 className="font-semibold text-content-primary mb-2 capitalize">
                    {role.replace('_', ' ')}s ({roleGameParticipants.length})
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {roleGameParticipants.map((participant) => (
                      <div key={participant.id} className="border border-theme-default rounded-lg p-4 surface-raised">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <div className="font-medium text-content-primary">{participant.username}</div>
                              {participant.role === 'audience' && <AudienceMemberBadge />}
                            </div>
                            <div className="text-sm text-content-tertiary">
                              Joined {new Date(participant.joined_at).toLocaleDateString()}
                            </div>
                          </div>
                          {isGM && participant.user_id !== currentUserId && game.state !== 'completed' && game.state !== 'cancelled' && (
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
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

        {/* Show public applicants list during recruitment */}
        {game.state === 'recruitment' && (
          <div className="mt-6 pt-6 border-t border-border-primary">
            <PublicApplicantsList gameId={gameId} />
          </div>
        )}
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

  // Common Room Tab (In Progress & Completed - common_room phases)
  if (activeTab === 'common-room' && (game.state === 'in_progress' || game.state === 'completed')) {
    // Show loading only on initial load (when we have no data yet)
    if (isLoadingPhase && !currentPhaseData) {
      return (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-interactive-primary"></div>
        </div>
      );
    }

    // Render CommonRoom if phase is common_room type
    // This stays mounted during refetches since currentPhaseData persists
    if (currentPhaseData?.phase?.phase_type === 'common_room') {
      return (
        <CommonRoom
          gameId={gameId}
          phaseId={currentPhaseData.phase.id}
          phaseTitle={currentPhaseData.phase.title || `Phase ${currentPhaseData.phase.phase_number}`}
          phaseDescription={currentPhaseData.phase.description}
          currentPhase={currentPhaseData.phase}
          isCurrentPhase={true}
          isGM={isGM}
        />
      );
    }

    // Phase exists but is not common_room type
    return (
      <div className="text-center py-12">
        <p className="text-content-secondary">
          Common Room is only available during Discussion phases.
        </p>
        <p className="text-content-tertiary mt-2">
          Current phase: {currentPhaseData?.phase?.phase_type}
        </p>
      </div>
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
          <>
            <ActionsList
              gameId={gameId}
              currentPhase={currentPhaseData?.phase}
              className="mb-6"
            />
            <GameResultsManager
              gameId={gameId}
            />
          </>
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

  // History Tab (In Progress & Completed)
  if (activeTab === 'history' && (game.state === 'in_progress' || game.state === 'completed')) {
    return <HistoryView gameId={gameId} currentPhaseId={currentPhaseData?.phase?.id} isGM={isGM} />;
  }

  // Private Messages Tab (In Progress & Completed)
  if (activeTab === 'messages' && (game.state === 'in_progress' || game.state === 'completed')) {
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

  // Handouts Tab (In Progress & Completed)
  if (activeTab === 'handouts' && (game.state === 'in_progress' || game.state === 'completed')) {
    return <HandoutsList gameId={gameId} isGM={isGM} />;
  }

  // Deadlines Tab (Character Creation, In Progress & Completed)
  if (activeTab === 'deadlines' && (game.state === 'character_creation' || game.state === 'in_progress' || game.state === 'completed' || game.state === 'cancelled')) {
    return <DeadlinesTabContent gameId={gameId} isGM={isGM} />;
  }

  // Audience Tab (In Progress & Completed)
  if (activeTab === 'audience' && (game.state === 'in_progress' || game.state === 'completed')) {
    return <AudienceView gameId={gameId} />;
  }

  // Default fallback
  return null;
}
