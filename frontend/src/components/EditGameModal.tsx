import { useState, useEffect } from 'react';
import type { GameWithDetails, UpdateGameRequest } from '../types/games';
import { apiClient } from '../lib/api';
import { Input, Button, Alert, Textarea, DateTimeInput, Checkbox } from './ui';

interface EditGameModalProps {
  game: GameWithDetails;
  isOpen: boolean;
  onClose: () => void;
  onGameUpdated: () => void;
}

export function EditGameModal({ game, isOpen, onClose, onGameUpdated }: EditGameModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [genre, setGenre] = useState('');
  const [maxPlayers, setMaxPlayers] = useState<number | ''>('');
  const [recruitmentDeadline, setRecruitmentDeadline] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize form with game data
  useEffect(() => {
    if (isOpen && game) {
      setTitle(game.title || '');
      setDescription(game.description || '');
      setGenre(game.genre || '');
      setMaxPlayers(game.max_players || '');
      setRecruitmentDeadline(game.recruitment_deadline ? formatDateTimeLocal(game.recruitment_deadline) : '');
      setStartDate(game.start_date ? formatDateTimeLocal(game.start_date) : '');
      setEndDate(game.end_date ? formatDateTimeLocal(game.end_date) : '');
      setIsPublic(true); // Default to true, adjust if we get this from backend
      setIsAnonymous(game.is_anonymous || false);
      setError(null);
    }
  }, [isOpen, game]);

  const formatDateTimeLocal = (dateString: string) => {
    const date = new Date(dateString);
    // Format as YYYY-MM-DDTHH:mm for datetime-local input
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError('Title is required');
      return;
    }

    if (!description.trim()) {
      setError('Description is required');
      return;
    }

    try {
      setLoading(true);

      const updateData: UpdateGameRequest = {
        title: title.trim(),
        description: description.trim(),
        genre: genre.trim() || undefined,
        max_players: maxPlayers === '' ? undefined : Number(maxPlayers),
        recruitment_deadline: recruitmentDeadline || undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        is_public: isPublic,
        is_anonymous: isAnonymous,
      };

      await apiClient.games.updateGame(game.id, updateData);
      onGameUpdated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update game');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="surface-base rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-content-primary">Edit Game</h2>
            <button
              onClick={onClose}
              className="text-content-secondary hover:text-content-primary transition-colors"
              type="button"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {error && (
            <Alert variant="danger" className="mb-4">{error}</Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Title"
              id="title"
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />

            <Textarea
              label="Description"
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              required
            />

            <Input
              label="Genre"
              id="genre"
              type="text"
              optional
              value={genre}
              onChange={(e) => setGenre(e.target.value)}
            />

            <Input
              label="Max Players"
              id="maxPlayers"
              type="number"
              optional
              value={maxPlayers}
              onChange={(e) => setMaxPlayers(e.target.value === '' ? '' : Number(e.target.value))}
              min={1}
            />

            <DateTimeInput
              label="Recruitment Deadline"
              id="recruitmentDeadline"
              optional
              value={recruitmentDeadline}
              onChange={(e) => setRecruitmentDeadline(e.target.value)}
            />

            <DateTimeInput
              label="Start Date"
              id="startDate"
              optional
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />

            <DateTimeInput
              label="End Date"
              id="endDate"
              optional
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />

            <Checkbox
              id="isAnonymous"
              label="Anonymous Mode (hides character ownership and NPC status from players)"
              checked={isAnonymous}
              onChange={(e) => setIsAnonymous(e.target.checked)}
            />

            <div className="flex gap-3 pt-4">
              <Button
                type="submit"
                variant="primary"
                loading={loading}
                className="flex-1"
              >
                Save Changes
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={onClose}
                disabled={loading}
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
