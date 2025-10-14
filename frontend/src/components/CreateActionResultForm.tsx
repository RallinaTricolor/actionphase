import React, { useState } from 'react';
import { useCreateActionResult } from '../hooks/useActionResults';

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
  const [content, setContent] = useState('');
  const [isPublished, setIsPublished] = useState(false);
  const createResult = useCreateActionResult(gameId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!content.trim()) {
      alert('Please enter result content');
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
      console.error('Failed to create action result:', error);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 bg-white border border-gray-200 rounded shadow-sm">
      <h4 className="font-semibold mb-2">Send Result to {userName}</h4>

      <div className="mb-4">
        <label htmlFor="content" className="block text-sm font-medium text-gray-700 mb-1">
          Result Content
        </label>
        <textarea
          id="content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          rows={4}
          placeholder="Enter the result of the player's action..."
        />
      </div>

      <div className="mb-4">
        <label className="flex items-center">
          <input
            type="checkbox"
            checked={isPublished}
            onChange={(e) => setIsPublished(e.target.checked)}
            className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
          />
          <span className="ml-2 text-sm text-gray-700">
            Publish immediately (visible to player)
          </span>
        </label>
      </div>

      <button
        type="submit"
        disabled={createResult.isPending}
        className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {createResult.isPending ? 'Sending...' : 'Send Result'}
      </button>

      {createResult.isError && (
        <p className="mt-2 text-sm text-red-600">
          Failed to send result. Please try again.
        </p>
      )}

      {createResult.isSuccess && (
        <p className="mt-2 text-sm text-green-600">
          Result sent successfully!
        </p>
      )}
    </form>
  );
};
