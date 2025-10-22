import { useState } from 'react';
import { apiClient } from '../lib/api';
import { Button, Alert } from './ui';
import { GameFormFields, type GameFormData } from './GameFormFields';
import type { CreateGameRequest } from '../types/games';

interface CreateGameFormProps {
  onSuccess?: (gameId: number) => void;
  onCancel?: () => void;
}

export const CreateGameForm = ({ onSuccess, onCancel }: CreateGameFormProps) => {
  const [formData, setFormData] = useState<GameFormData>({
    title: '',
    description: '',
    genre: '',
    start_date: '',
    end_date: '',
    recruitment_deadline: '',
    max_players: 6,
    is_anonymous: false,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      // Validate required fields
      if (!formData.title.trim()) {
        throw new Error('Game title is required');
      }
      if (!formData.description.trim()) {
        throw new Error('Game description is required');
      }

      // Prepare data for API (convert empty strings to undefined for optional dates)
      const gameData: CreateGameRequest = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        genre: formData.genre?.trim() || undefined,
        start_date: formData.start_date || undefined,
        end_date: formData.end_date || undefined,
        recruitment_deadline: formData.recruitment_deadline || undefined,
        max_players: formData.max_players === '' ? undefined : Number(formData.max_players),
        is_anonymous: formData.is_anonymous,
      };

      const response = await apiClient.games.createGame(gameData);
      onSuccess?.(response.data.id);
    } catch (err: any) {
      // Extract error message from Axios error response or use generic message
      const errorMessage = err?.response?.data?.error ||
        (err?.message && err.message !== 'Network Error' ? err.message : 'Failed to create game');
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (field: keyof GameFormData, value: string | number | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="max-w-2xl mx-auto">
      {error && (
        <Alert variant="danger" className="mb-6" dismissible onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <GameFormFields
          formData={formData}
          onChange={handleChange}
        />

        {/* Info Box */}
        <Alert variant="info" title="Game Creation Process">
          <ul className="text-sm space-y-1 list-disc list-inside">
            <li>Your game will start in "Setup" mode after creation</li>
            <li>Switch to "Recruitment" when ready to accept players</li>
            <li>Players can join until the recruitment deadline</li>
            <li>Move to "Character Creation" once recruitment is complete</li>
          </ul>
        </Alert>

        {/* Buttons */}
        <div className="flex gap-4 pt-4">
          <Button
            type="submit"
            variant="primary"
            loading={isSubmitting}
            className="flex-1"
          >
            {isSubmitting ? 'Creating Game...' : 'Create Game'}
          </Button>
          {onCancel && (
            <Button
              type="button"
              variant="secondary"
              onClick={onCancel}
              className="px-6"
            >
              Cancel
            </Button>
          )}
        </div>
      </form>
    </div>
  );
};
