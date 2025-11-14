import React, { useState } from 'react';
import { useCreateActionResult } from '../hooks/useActionResults';
import { useToast } from '../contexts/ToastContext';
import { Button, Textarea, Alert } from './ui';
import { logger } from '@/services/LoggingService';

interface CreateActionResultFormProps {
  gameId: number;
  userId: number;
  userName: string;
  characterId?: number;
  characterName?: string;
  actionSubmissionId?: number;
  onSuccess?: () => void;
}

export const CreateActionResultForm: React.FC<CreateActionResultFormProps> = ({
  gameId,
  userId,
  userName,
  characterId,
  characterName,
  actionSubmissionId,
  onSuccess,
}) => {
  const { showWarning } = useToast();
  const [content, setContent] = useState('');
  const createResult = useCreateActionResult(gameId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!content.trim()) {
      showWarning('Please enter result content');
      return;
    }

    try {
      await createResult.mutateAsync({
        user_id: userId,
        character_id: characterId,
        action_submission_id: actionSubmissionId,
        content: content.trim(),
        is_published: false, // Always create as draft
      });

      setContent('');
      onSuccess?.();
    } catch (error) {
      logger.error('Failed to create action result', { error, gameId, userId, userName, characterId, characterName, actionSubmissionId });
    }
  };

  const recipientLabel = characterName ? `${characterName} (${userName})` : userName;

  return (
    <form onSubmit={handleSubmit} className="p-4 surface-base border border-theme-default rounded shadow-sm">
      <h4 className="font-semibold text-content-primary mb-2">Send Result to {recipientLabel}</h4>

      <div className="mb-4">
        <Textarea
          id="content"
          label="Result Content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={4}
          placeholder="Enter the result of the player's action..."
          maxLength={100000}
          showCharacterCount={true}
          helperText="Maximum 100,000 characters. Result will be created as a draft."
        />
      </div>

      <Button
        type="submit"
        variant="primary"
        disabled={createResult.isPending}
        className="w-full"
      >
        {createResult.isPending ? 'Creating...' : 'Create Draft Result'}
      </Button>

      {createResult.isError && (
        <Alert variant="danger" className="mt-2">
          Failed to create result. Please try again.
        </Alert>
      )}

      {createResult.isSuccess && (
        <Alert variant="success" className="mt-2">
          Draft result created! Add character updates and publish when ready.
        </Alert>
      )}
    </form>
  );
};
