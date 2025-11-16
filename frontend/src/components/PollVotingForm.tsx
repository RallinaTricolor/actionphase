import { useState } from 'react';
import { useSubmitVote } from '../hooks';
import { useUserCharacters } from '../hooks';
import { Button, Alert, Input, Select } from './ui';
import type { PollWithOptions, SubmitVoteRequest } from '../types/polls';
import { logger } from '@/services/LoggingService';

interface PollVotingFormProps {
  poll: PollWithOptions;
  onSuccess: () => void;
  onCancel: () => void;
  isChangingVote?: boolean; // If true, allow changing votes for characters that have already voted
}

export function PollVotingForm({ poll, onSuccess, onCancel, isChangingVote = false }: PollVotingFormProps) {
  const submitVoteMutation = useSubmitVote(poll.id, poll.game_id);
  const { characters } = useUserCharacters(poll.game_id);

  // Filter out characters that have already voted (for character-level polls)
  // UNLESS we're changing a vote, in which case show all characters
  const availableCharacters = poll.vote_as_type === 'character' && poll.voted_character_ids && !isChangingVote
    ? characters.filter(c => !poll.voted_character_ids!.includes(c.id))
    : characters;

  const [selectedOptionId, setSelectedOptionId] = useState<number | null>(null);
  const [selectedCharacterId, setSelectedCharacterId] = useState<number | null>(
    poll.vote_as_type === 'character' && availableCharacters.length === 1 ? availableCharacters[0].id : null
  );
  const [otherText, setOtherText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (poll.vote_as_type === 'character' && !selectedCharacterId) {
      setError('Please select a character to vote as');
      return;
    }

    if (!selectedOptionId && !otherText.trim()) {
      setError('Please select an option or provide a custom response');
      return;
    }

    try {
      // Build vote data object explicitly to avoid spread operator issues
      const voteData: Partial<SubmitVoteRequest> = {};

      // Add selected_option_id if it's a valid option (not null and not -1 for "Other")
      if (selectedOptionId !== null && selectedOptionId !== -1) {
        voteData.selected_option_id = selectedOptionId;
      }

      // Add character_id if voting as character
      if (poll.vote_as_type === 'character' && selectedCharacterId) {
        voteData.character_id = selectedCharacterId;
      }

      // Add other_response if provided
      if (otherText.trim()) {
        voteData.other_response = otherText.trim();
      }

      await submitVoteMutation.mutateAsync(voteData);
      onSuccess();
    } catch (_err) {
      logger.error('Failed to submit vote', { error: err, pollId: poll.id, gameId: poll.game_id, characterId: selectedCharacterId });
      setError(err instanceof Error ? err.message : 'Failed to submit vote');
    }
  };

  const isOtherSelected = selectedOptionId === -1;

  return (
    <form onSubmit={handleSubmit} className="space-y-4 border-t border-border-primary pt-4">
      {/* Character Selection (if voting as character) */}
      {poll.vote_as_type === 'character' && (
        <div>
          <label className="block text-sm font-medium text-text-primary mb-2">
            Vote as Character
          </label>
          {availableCharacters.length === 0 ? (
            <Alert variant="warning" title="No Characters Available">
              {characters.length === 0
                ? "You don't have any characters in this game."
                : isChangingVote
                  ? "You don't have any characters in this game."
                  : "You've already voted with all your characters."}
            </Alert>
          ) : availableCharacters.length === 1 ? (
            <div className="text-sm text-text-secondary">
              Voting as: <span className="font-medium text-text-primary">{availableCharacters[0].name}</span>
            </div>
          ) : (
            <Select
              value={selectedCharacterId?.toString() || ''}
              onChange={(e) => setSelectedCharacterId(parseInt(e.target.value))}
              required
            >
              <option value="">Select a character...</option>
              {availableCharacters.map((char) => (
                <option key={char.id} value={char.id}>
                  {char.name}
                </option>
              ))}
            </Select>
          )}
        </div>
      )}

      {/* Options */}
      <div>
        <label className="block text-sm font-medium text-text-primary mb-2">
          Select your response
        </label>
        <div className="space-y-2">
          {poll.options.map((option) => (
            <label
              key={option.id}
              className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                selectedOptionId === option.id
                  ? 'border-accent-primary bg-accent-primary/10'
                  : 'border-border-primary hover:border-border-secondary bg-bg-secondary'
              }`}
            >
              <input
                type="radio"
                name="poll-option"
                value={option.id}
                checked={selectedOptionId === option.id}
                onChange={() => {
                  setSelectedOptionId(option.id);
                  setOtherText(''); // Clear other text if selecting an option
                }}
                className="mt-1 text-accent-primary focus:ring-accent-primary"
              />
              <span className="flex-1 text-sm text-text-primary">{option.option_text}</span>
            </label>
          ))}

          {/* "Other" Option */}
          {poll.allow_other_option && (
            <label
              className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                isOtherSelected
                  ? 'border-accent-primary bg-accent-primary/10'
                  : 'border-border-primary hover:border-border-secondary bg-bg-secondary'
              }`}
            >
              <input
                type="radio"
                name="poll-option"
                value="-1"
                checked={isOtherSelected}
                onChange={() => {
                  setSelectedOptionId(-1);
                }}
                className="mt-1 text-accent-primary focus:ring-accent-primary"
              />
              <div className="flex-1 space-y-2">
                <span className="text-sm text-text-primary">Other (specify below)</span>
                {isOtherSelected && (
                  <Input
                    value={otherText}
                    onChange={(e) => setOtherText(e.target.value)}
                    placeholder="Enter your custom response..."
                    required={isOtherSelected}
                    className="mt-2"
                    onClick={(e) => e.stopPropagation()} // Prevent label click
                  />
                )}
              </div>
            </label>
          )}
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <Alert variant="danger" title="Error">
          {error}
        </Alert>
      )}

      {/* Form Actions */}
      <div className="flex gap-2 justify-end pt-2">
        <Button
          type="button"
          variant="secondary"
          onClick={onCancel}
          disabled={submitVoteMutation.isPending}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          variant="primary"
          loading={submitVoteMutation.isPending}
          disabled={
            (poll.vote_as_type === 'character' && !selectedCharacterId) ||
            (!selectedOptionId && !otherText.trim())
          }
        >
          Submit Vote
        </Button>
      </div>
    </form>
  );
}
