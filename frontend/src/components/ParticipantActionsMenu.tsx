/**
 * Participant Actions Menu Component
 *
 * Provides a dropdown menu for GM actions on game participants:
 * - Promote audience members to co-GM
 * - Demote co-GM back to audience
 * - Remove players from game
 *
 * Only shows actions appropriate for the participant's current role.
 * Only primary GM can promote/demote. Both primary and co-GM can remove.
 */

import { useState, useRef, useEffect } from 'react';
import { Button, Alert } from './ui';
import { Modal } from './Modal';
import { usePromoteToCoGM, useDemoteFromCoGM, useRemovePlayer } from '../hooks/usePlayerManagement';
import type { GameParticipant } from '../types/games';
import { logger } from '@/services/LoggingService';

interface ParticipantActionsMenuProps {
  gameId: number;
  participant: GameParticipant;
  isPrimaryGM: boolean;
  onSuccess?: () => void;
}

export function ParticipantActionsMenu({
  gameId,
  participant,
  isPrimaryGM,
  onSuccess
}: ParticipantActionsMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showPromoteConfirm, setShowPromoteConfirm] = useState(false);
  const [showDemoteConfirm, setShowDemoteConfirm] = useState(false);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const promoteToCoGM = usePromoteToCoGM(gameId);
  const demoteFromCoGM = useDemoteFromCoGM(gameId);
  const removePlayer = useRemovePlayer(gameId);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handlePromote = async () => {
    try {
      await promoteToCoGM.mutateAsync(participant.user_id);
      setShowPromoteConfirm(false);
      setIsOpen(false);
      onSuccess?.();
    } catch (error) {
      logger.error('Failed to promote to co-GM', { error, gameId, userId: participant.user_id, username: participant.username });
    }
  };

  const handleDemote = async () => {
    try {
      await demoteFromCoGM.mutateAsync(participant.user_id);
      setShowDemoteConfirm(false);
      setIsOpen(false);
      onSuccess?.();
    } catch (error) {
      logger.error('Failed to demote from co-GM', { error, gameId, userId: participant.user_id, username: participant.username });
    }
  };

  const handleRemove = async () => {
    try {
      await removePlayer.mutateAsync(participant.user_id);
      setShowRemoveConfirm(false);
      setIsOpen(false);
      onSuccess?.();
    } catch (error) {
      logger.error('Failed to remove player', { error, gameId, userId: participant.user_id, username: participant.username });
    }
  };

  const canPromote = isPrimaryGM && participant.role === 'audience';
  const canDemote = isPrimaryGM && participant.role === 'co_gm';
  const canRemove = true; // Both primary GM and co-GM can remove

  // If no actions available, don't render anything
  if (!canPromote && !canDemote && !canRemove) {
    return null;
  }

  return (
    <>
      <div className="relative" ref={menuRef}>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setIsOpen(!isOpen)}
          aria-label="Participant actions"
        >
          ⋮
        </Button>

        {isOpen && (
          <div className="absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-bg-primary border border-border-primary z-10 surface-raised">
            <div className="py-1" role="menu">
              {canPromote && (
                <button
                  onClick={() => {
                    setShowPromoteConfirm(true);
                    setIsOpen(false);
                  }}
                  className="block w-full text-left px-4 py-2 text-sm text-content-primary hover:bg-bg-secondary"
                  role="menuitem"
                >
                  Promote to Co-GM
                </button>
              )}

              {canDemote && (
                <button
                  onClick={() => {
                    setShowDemoteConfirm(true);
                    setIsOpen(false);
                  }}
                  className="block w-full text-left px-4 py-2 text-sm text-content-primary hover:bg-bg-secondary"
                  role="menuitem"
                >
                  Demote from Co-GM
                </button>
              )}

              {canRemove && (
                <button
                  onClick={() => {
                    setShowRemoveConfirm(true);
                    setIsOpen(false);
                  }}
                  className="block w-full text-left px-4 py-2 text-sm text-semantic-danger hover:bg-bg-secondary"
                  role="menuitem"
                >
                  Remove Player
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Promote to Co-GM Confirmation Modal */}
      <Modal
        isOpen={showPromoteConfirm}
        onClose={() => setShowPromoteConfirm(false)}
        title="Promote to Co-GM?"
      >
        <div className="space-y-4">
          <Alert variant="info" title="Co-GM Permissions">
            <p className="text-sm">
              Co-GMs can do everything you can except:
            </p>
            <ul className="text-sm space-y-1 list-disc list-inside mt-2">
              <li>Edit game settings (title, description, etc.)</li>
              <li>Promote others to co-GM</li>
            </ul>
            <p className="text-sm mt-2">
              They will have full access to manage phases, characters, actions, and messages.
            </p>
          </Alert>

          <p className="text-sm text-content-secondary">
            Promote <strong>{participant.username}</strong> to co-GM?
          </p>

          <div className="flex justify-end gap-3">
            <Button
              variant="secondary"
              onClick={() => setShowPromoteConfirm(false)}
              disabled={promoteToCoGM.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handlePromote}
              loading={promoteToCoGM.isPending}
            >
              Promote to Co-GM
            </Button>
          </div>

          {promoteToCoGM.isError && (
            <Alert variant="danger" dismissible onDismiss={() => promoteToCoGM.reset()}>
              <p className="text-sm">
                Failed to promote to co-GM. {(promoteToCoGM.error as Error)?.message || 'Please try again.'}
              </p>
            </Alert>
          )}
        </div>
      </Modal>

      {/* Demote from Co-GM Confirmation Modal */}
      <Modal
        isOpen={showDemoteConfirm}
        onClose={() => setShowDemoteConfirm(false)}
        title="Demote from Co-GM?"
      >
        <div className="space-y-4">
          <p className="text-sm text-content-secondary">
            <strong>{participant.username}</strong> will be demoted from co-GM to audience member.
            They will lose GM permissions but remain in the game.
          </p>

          <div className="flex justify-end gap-3">
            <Button
              variant="secondary"
              onClick={() => setShowDemoteConfirm(false)}
              disabled={demoteFromCoGM.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleDemote}
              loading={demoteFromCoGM.isPending}
            >
              Demote to Audience
            </Button>
          </div>

          {demoteFromCoGM.isError && (
            <Alert variant="danger" dismissible onDismiss={() => demoteFromCoGM.reset()}>
              <p className="text-sm">
                Failed to demote from co-GM. {(demoteFromCoGM.error as Error)?.message || 'Please try again.'}
              </p>
            </Alert>
          )}
        </div>
      </Modal>

      {/* Remove Player Confirmation Modal */}
      <Modal
        isOpen={showRemoveConfirm}
        onClose={() => setShowRemoveConfirm(false)}
        title="Remove Player from Game?"
      >
        <div className="space-y-4">
          <Alert variant="danger" title="Warning: This action has serious consequences">
            <ul className="text-sm space-y-1 list-disc list-inside">
              <li>Player <strong>{participant.username}</strong> will be removed from the game</li>
              <li>They will lose all access to the game immediately</li>
              <li>Their character(s) will be marked as inactive</li>
              <li>You can reassign their characters to yourself or other players</li>
              <li>This action can be reversed by adding them back</li>
            </ul>
          </Alert>

          <p className="text-sm text-content-secondary">
            Are you sure you want to remove this player?
          </p>

          <div className="flex justify-end gap-3">
            <Button
              variant="secondary"
              onClick={() => setShowRemoveConfirm(false)}
              disabled={removePlayer.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleRemove}
              loading={removePlayer.isPending}
            >
              Remove Player
            </Button>
          </div>

          {removePlayer.isError && (
            <Alert variant="danger" dismissible onDismiss={() => removePlayer.reset()}>
              <p className="text-sm">
                Failed to remove player. {(removePlayer.error as Error)?.message || 'Please try again.'}
              </p>
            </Alert>
          )}
        </div>
      </Modal>
    </>
  );
}
