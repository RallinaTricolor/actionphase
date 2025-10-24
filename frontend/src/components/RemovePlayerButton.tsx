/**
 * Remove Player Button Component
 *
 * Allows GMs to remove players from their game with a confirmation dialog.
 * Warns about consequences (character deactivation, loss of access).
 */

import { useState } from 'react';
import { Button } from './ui';
import { Modal } from './Modal';
import { useRemovePlayer } from '../hooks/usePlayerManagement';
import type { GameParticipant } from '../types/games';

interface RemovePlayerButtonProps {
  gameId: number;
  participant: GameParticipant;
  onSuccess?: () => void;
}

export function RemovePlayerButton({ gameId, participant, onSuccess }: RemovePlayerButtonProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const removePlayer = useRemovePlayer(gameId);

  const handleRemove = async () => {
    try {
      await removePlayer.mutateAsync(participant.user_id);
      setShowConfirm(false);
      onSuccess?.();
    } catch (error) {
      console.error('Failed to remove player:', error);
    }
  };

  return (
    <>
      <Button
        variant="danger"
        size="sm"
        onClick={() => setShowConfirm(true)}
      >
        Remove Player
      </Button>

      <Modal
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        title="Remove Player from Game?"
      >
        <div className="space-y-4">
          <div className="p-4 rounded-lg bg-semantic-danger-subtle border border-semantic-danger">
            <p className="text-sm font-medium text-semantic-danger mb-2">
              Warning: This action has serious consequences
            </p>
            <ul className="text-sm text-content-primary space-y-1 list-disc list-inside">
              <li>Player <strong>{participant.username}</strong> will be removed from the game</li>
              <li>They will lose all access to the game immediately</li>
              <li>Their character(s) will be marked as inactive</li>
              <li>You can reassign their characters to yourself or other players</li>
              <li>This action can be reversed by adding them back</li>
            </ul>
          </div>

          <p className="text-sm text-content-secondary">
            Are you sure you want to remove this player?
          </p>

          <div className="flex justify-end gap-3">
            <Button
              variant="secondary"
              onClick={() => setShowConfirm(false)}
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
            <div className="p-3 rounded-lg bg-semantic-danger-subtle border border-semantic-danger">
              <p className="text-sm text-semantic-danger">
                Failed to remove player. Please try again.
              </p>
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}
