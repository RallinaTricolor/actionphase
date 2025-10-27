import { useState } from 'react';
import { apiClient } from '../lib/api';
import type { ApplyToGameRequest } from '../types/games';
import { Modal } from './Modal';
import { Button, Alert, Select, Textarea } from './ui';

interface ApplyToGameModalProps {
  gameId: number;
  gameTitle: string;
  isOpen: boolean;
  onClose: () => void;
  onApplicationSubmitted: () => void;
}

export const ApplyToGameModal = ({
  gameId,
  gameTitle,
  isOpen,
  onClose,
  onApplicationSubmitted
}: ApplyToGameModalProps) => {
  const [formData, setFormData] = useState<ApplyToGameRequest>({
    role: 'player',
    message: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setSubmitting(true);
      setError(null);

      await apiClient.games.applyToGame(gameId, {
        role: formData.role,
        message: formData.message?.trim() || undefined
      });

      onApplicationSubmitted();
      onClose();

      // Reset form
      setFormData({
        role: 'player',
        message: ''
      });
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'Failed to submit application';
      setError(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!submitting) {
      setError(null);
      onClose();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={`Apply to ${gameTitle}`}>
      <form onSubmit={handleSubmit} className="space-y-6" data-testid="application-form">
        {error && (
          <Alert variant="danger">{error}</Alert>
        )}

        <Select
          label="Role"
          id="role"
          value={formData.role}
          onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value as 'player' | 'audience' }))}
          disabled={submitting}
          helperText={
            formData.role === 'player'
              ? 'Actively participate in the game'
              : 'Watch and follow the game story'
          }
          data-testid="application-role-select"
        >
          <option value="player">Player</option>
          <option value="audience">Audience</option>
        </Select>

        <Textarea
          label="Application Message"
          id="message"
          optional
          value={formData.message}
          onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
          placeholder="Tell the GM why you'd like to join this game..."
          rows={4}
          disabled={submitting}
          helperText="Share your interest in the game, character ideas, or experience with the genre."
          data-testid="application-message"
        />

        <div className="flex gap-3 pt-4">
          <Button
            type="button"
            variant="secondary"
            onClick={handleClose}
            disabled={submitting}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            loading={submitting}
            className="flex-1"
            data-testid="submit-application"
          >
            Submit Application
          </Button>
        </div>
      </form>
    </Modal>
  );
};
