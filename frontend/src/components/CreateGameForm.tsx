import { useState } from 'react';
import { apiClient } from '../lib/api';
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

      const response = await apiClient.createGame(gameData);
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
      <div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-600">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Title */}
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
              Game Title *
            </label>
            <input
              type="text"
              id="title"
              value={formData.title}
              onChange={(e) => handleChange('title', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter a compelling game title"
              maxLength={255}
              required
            />
          </div>

          {/* Description */}
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
              Description *
            </label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Describe your game world, setting, and what players can expect..."
              required
            />
          </div>

          {/* Genre */}
          <div>
            <label htmlFor="genre" className="block text-sm font-medium text-gray-700 mb-2">
              Genre
            </label>
            <input
              type="text"
              id="genre"
              value={formData.genre}
              onChange={(e) => handleChange('genre', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g., Fantasy, Sci-Fi, Horror, Modern"
              maxLength={100}
            />
          </div>

          {/* Max Players */}
          <div>
            <label htmlFor="max_players" className="block text-sm font-medium text-gray-700 mb-2">
              Maximum Players
            </label>
            <input
              type="number"
              id="max_players"
              value={formData.max_players || ''}
              onChange={(e) => handleChange('max_players', parseInt(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              min="1"
              max="20"
              placeholder="6"
            />
            <p className="text-sm text-gray-500 mt-1">Leave empty for default (6 players)</p>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label htmlFor="recruitment_deadline" className="block text-sm font-medium text-gray-700 mb-2">
                Recruitment Deadline
              </label>
              <input
                type="datetime-local"
                id="recruitment_deadline"
                value={formData.recruitment_deadline}
                onChange={(e) => handleChange('recruitment_deadline', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label htmlFor="start_date" className="block text-sm font-medium text-gray-700 mb-2">
                Start Date
              </label>
              <input
                type="datetime-local"
                id="start_date"
                value={formData.start_date}
                onChange={(e) => handleChange('start_date', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label htmlFor="end_date" className="block text-sm font-medium text-gray-700 mb-2">
                End Date
              </label>
              <input
                type="datetime-local"
                id="end_date"
                value={formData.end_date}
                onChange={(e) => handleChange('end_date', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Info Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="text-sm font-medium text-blue-800 mb-2">Game Creation Process</h4>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• Your game will start in "Setup" mode after creation</li>
              <li>• Switch to "Recruitment" when ready to accept players</li>
              <li>• Players can join until the recruitment deadline</li>
              <li>• Move to "Character Creation" once recruitment is complete</li>
            </ul>
          </div>

          {/* Buttons */}
          <div className="flex gap-4 pt-4">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white py-3 px-4 rounded-lg font-medium transition-colors"
            >
              {isSubmitting ? 'Creating Game...' : 'Create Game'}
            </button>
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
