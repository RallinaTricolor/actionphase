import { useState } from 'react';
import { apiClient } from '../lib/api';
import { Button, Input, Alert, Textarea, DateTimeInput } from './ui';
import type { CreateGameRequest } from '../types/games';

interface CreateGameFormProps {
  onSuccess?: (gameId: number) => void;
  onCancel?: () => void;
}

export const CreateGameForm = ({ onSuccess, onCancel }: CreateGameFormProps) => {
  const [formData, setFormData] = useState<CreateGameRequest>({
    title: '',
    description: '',
    genre: '',
    start_date: '',
    end_date: '',
    recruitment_deadline: '',
    max_players: 6,
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
        ...formData,
        title: formData.title.trim(),
        description: formData.description.trim(),
        genre: formData.genre?.trim() || undefined,
        start_date: formData.start_date || undefined,
        end_date: formData.end_date || undefined,
        recruitment_deadline: formData.recruitment_deadline || undefined,
        max_players: formData.max_players || undefined,
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

  const handleChange = (field: keyof CreateGameRequest, value: string | number) => {
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
        {/* Title */}
        <Input
          label="Game Title"
          id="title"
          type="text"
          required
          value={formData.title}
          onChange={(e) => handleChange('title', e.target.value)}
          placeholder="Enter a compelling game title"
          maxLength={255}
        />

        {/* Description */}
        <Textarea
          label="Description"
          id="description"
          value={formData.description}
          onChange={(e) => handleChange('description', e.target.value)}
          rows={4}
          required
          placeholder="Describe your game world, setting, and what players can expect..."
        />

        {/* Genre */}
        <Input
          label="Genre"
          id="genre"
          type="text"
          optional
          value={formData.genre}
          onChange={(e) => handleChange('genre', e.target.value)}
          placeholder="e.g., Fantasy, Sci-Fi, Horror, Modern"
          maxLength={100}
        />

        {/* Max Players */}
        <Input
          label="Maximum Players"
          id="max_players"
          type="number"
          value={formData.max_players || ''}
          onChange={(e) => handleChange('max_players', parseInt(e.target.value) || 0)}
          helperText="Leave empty for default (6 players)"
          min={1}
          max={20}
          placeholder="6"
        />

        {/* Dates */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <DateTimeInput
            label="Recruitment Deadline"
            id="recruitment_deadline"
            optional
            value={formData.recruitment_deadline}
            onChange={(e) => handleChange('recruitment_deadline', e.target.value)}
          />

          <DateTimeInput
            label="Start Date"
            id="start_date"
            optional
            value={formData.start_date}
            onChange={(e) => handleChange('start_date', e.target.value)}
          />

          <DateTimeInput
            label="End Date"
            id="end_date"
            optional
            value={formData.end_date}
            onChange={(e) => handleChange('end_date', e.target.value)}
          />
        </div>

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
