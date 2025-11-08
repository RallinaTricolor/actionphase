import React, { useState } from 'react';
import { useCreateActionResult } from '../hooks/useActionResults';
import { useToast } from '../contexts/ToastContext';
import { Button, Textarea, Checkbox, Alert } from './ui';
import { logger } from '@/services/LoggingService';

interface CreateActionResultFormProps {
  gameId: number;
  userId: number;
  userName: string;
  onSuccess?: () => void;
}

export const CreateActionResultForm: React.FC<CreateActionResultFormProps> = ({
  gameId,
  userId,
  userName,
  onSuccess,
}) => {
  const { showWarning } = useToast();
  const [content, setContent] = useState('');
  const [isPublished, setIsPublished] = useState(false);
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
        content: content.trim(),
        is_published: isPublished,
      });

      setContent('');
      setIsPublished(false);
      onSuccess?.();
    } catch (error) {
      logger.error('Failed to create action result', { error, gameId, userId, userName, isPublished });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 surface-base border border-theme-default rounded shadow-sm">
      <h4 className="font-semibold text-content-primary mb-2">Send Result to {userName}</h4>

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
          helperText="Maximum 100,000 characters"
        />
      </div>

      <div className="mb-4">
        <Checkbox
          id="publish-immediately"
          checked={isPublished}
          onChange={(e) => setIsPublished(e.target.checked)}
          label="Publish immediately (visible to player)"
        />
      </div>

      <Button
        type="submit"
        variant="primary"
        disabled={createResult.isPending}
        className="w-full"
      >
        {createResult.isPending ? 'Sending...' : 'Send Result'}
      </Button>

      {createResult.isError && (
        <Alert variant="danger" className="mt-2">
          Failed to send result. Please try again.
        </Alert>
      )}

      {createResult.isSuccess && (
        <Alert variant="success" className="mt-2">
          Result sent successfully!
        </Alert>
      )}
    </form>
  );
};
