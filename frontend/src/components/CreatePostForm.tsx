import { useState, useEffect } from 'react';
import type { Character } from '../types/characters';
import { CommentEditor } from './CommentEditor';

interface CreatePostFormProps {
  gameId: number;
  characters: Character[]; // Characters the user can post as
  allCharacters?: Character[]; // All characters for autocomplete mentions
  onSubmit: (characterId: number, content: string) => Promise<void>;
  isSubmitting: boolean;
}

export function CreatePostForm({ gameId, characters, allCharacters, onSubmit, isSubmitting }: CreatePostFormProps) {
  const [selectedCharacterId, setSelectedCharacterId] = useState<number | null>(null);
  const [content, setContent] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Auto-select first character if available
  useEffect(() => {
    if (characters.length > 0 && selectedCharacterId === null) {
      setSelectedCharacterId(characters[0].id);
    }
  }, [characters, selectedCharacterId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedCharacterId) {
      setError('Please select a character');
      return;
    }

    if (!content.trim()) {
      setError('Please enter a message');
      return;
    }

    try {
      await onSubmit(selectedCharacterId, content.trim());
      setContent('');
    } catch (err: any) {
      // Use fallback message for generic errors like "Network error"
      const errorMessage = err instanceof Error && err.message !== 'Network error'
        ? err.message
        : 'Failed to create post';
      setError(errorMessage);
    }
  };

  if (characters.length === 0) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <p className="text-yellow-800">
          You need a character to post in the Common Room. Please create a character first.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 shadow-lg rounded-lg p-6 mb-6">
      <div className="flex items-center gap-2 mb-4">
        <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
        </svg>
        <h3 className="text-lg font-bold text-gray-900">Create New GM Post</h3>
      </div>

      <div className="bg-blue-100 border border-blue-300 rounded-lg p-3 mb-4">
        <p className="text-sm text-blue-800">
          <strong>💡 Tip:</strong> You can use Markdown formatting for rich text. Type <code className="bg-blue-200 px-1 rounded">@</code> to mention characters and trigger autocomplete.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded p-3 mb-4">
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}

      {/* Only show character selector if user has multiple characters */}
      {characters.length > 1 && (
        <div className="mb-4">
          <label htmlFor="character" className="block text-sm font-medium text-gray-700 mb-2">
            Post as:
          </label>
          <select
            id="character"
            value={selectedCharacterId || ''}
            onChange={(e) => setSelectedCharacterId(Number(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isSubmitting}
          >
            {characters.map((char) => (
              <option key={char.id} value={char.id}>
                {char.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="mb-4">
        <label htmlFor="content" className="block text-sm font-medium text-gray-700 mb-2">
          Post Content (Markdown supported):
        </label>
        <CommentEditor
          id="content"
          value={content}
          onChange={setContent}
          placeholder="# Phase Title&#10;&#10;## Important Information&#10;&#10;Your phase description here...&#10;&#10;- Bullet point 1&#10;- Bullet point 2&#10;&#10;**Remember:** This post will be visible to all players.&#10;&#10;💡 Use @CharacterName to mention characters"
          disabled={isSubmitting}
          rows={12}
          characters={allCharacters || characters}
          showPreviewByDefault={false}
        />
        <p className="text-xs text-gray-500 mt-1">
          {content.length} characters (longer posts will be collapsible for players)
        </p>
      </div>

      <button
        type="submit"
        disabled={isSubmitting || !content.trim()}
        className="w-full bg-blue-600 text-white px-4 py-3 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-semibold text-lg"
      >
        {isSubmitting ? 'Creating GM Post...' : 'Create GM Post'}
      </button>
    </form>
  );
}
