import { useState } from 'react';
import { CharactersList } from './CharactersList';
import { RemovePlayerButton } from './RemovePlayerButton';
import { AddPlayerModal } from './AddPlayerModal';
import { InactiveCharactersList } from './InactiveCharactersList';
import { AudienceMemberBadge } from './AudienceMemberBadge';
import { Button } from './ui';
import type { GameParticipant } from '../types/games';

interface PeopleViewProps {
  gameId: number;
  participants: GameParticipant[];
  isGM: boolean;
  currentUserId: number | null;
  gameState?: string;
  isAnonymous?: boolean;
}

type SubTab = 'characters' | 'participants';

/**
 * Combined view for Characters and GameParticipants
 * Reduces tab clutter by grouping related people management features
 */
export function PeopleView({
  gameId,
  participants,
  isGM,
  currentUserId,
  gameState,
  isAnonymous = false
}: PeopleViewProps) {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('characters');
  const [showAddPlayerModal, setShowAddPlayerModal] = useState(false);

  return (
    <div className="space-y-6">
      {/* Sub-tab navigation */}
      <div className="border-b border-border-primary">
        <nav className="flex gap-4">
          <button
            onClick={() => setActiveSubTab('characters')}
            className={`
              pb-3 px-2 border-b-2 font-medium text-sm transition-colors
              ${activeSubTab === 'characters'
                ? 'border-interactive-primary text-interactive-primary'
                : 'border-transparent text-content-secondary hover:text-content-primary'
              }
            `}
          >
            Characters
          </button>
          <button
            onClick={() => setActiveSubTab('participants')}
            className={`
              pb-3 px-2 border-b-2 font-medium text-sm transition-colors
              ${activeSubTab === 'participants'
                ? 'border-interactive-primary text-interactive-primary'
                : 'border-transparent text-content-secondary hover:text-content-primary'
              }
            `}
          >
            GameParticipants ({participants.length})
          </button>
        </nav>
      </div>

      {/* Characters sub-tab */}
      {activeSubTab === 'characters' && (
        <CharactersList
          gameId={gameId}
          userRole={isGM ? 'gm' : 'player'}
          currentUserId={currentUserId || undefined}
          gameState={gameState}
          isAnonymous={isAnonymous}
        />
      )}

      {/* GameParticipants sub-tab */}
      {activeSubTab === 'participants' && (
        <>
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-content-primary">GameParticipants</h2>
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
      )}
    </div>
  );
}
