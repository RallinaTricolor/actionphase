import { useState } from 'react';
import { apiClient } from '../lib/api';
import type { ApplyToGameRequest } from '../types/games';
import { Modal } from './Modal';

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

      await apiClient.applyToGame(gameId, {
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
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}

        <div>
          <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-2">
            Role
          </label>
          <select
            id="role"
            value={formData.role}
            onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value as 'player' | 'audience' }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            disabled={submitting}
          >
            <option value="player">Player</option>
            <option value="audience">Audience</option>
          </select>
          <p className="text-xs text-gray-500 mt-1">
            {formData.role === 'player'
              ? 'Actively participate in the game'
              : 'Watch and follow the game story'}
          </p>
        </div>

        <div>
          <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-2">
            Application Message
            <span className="text-gray-400 font-normal"> (Optional)</span>
          </label>
          <textarea
            id="message"
            value={formData.message}
            onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
            placeholder="Tell the GM why you'd like to join this game..."
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors resize-none"
            disabled={submitting}
          />
          <p className="text-xs text-gray-500 mt-1">
            Share your interest in the game, character ideas, or experience with the genre.
          </p>
        </div>

        <div className="flex gap-3 pt-4">
          <button
            type="button"
            onClick={handleClose}
            disabled={submitting}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Submitting...' : 'Submit Application'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
