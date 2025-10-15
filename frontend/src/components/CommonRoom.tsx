import { useState, useEffect } from 'react';
import { apiClient } from '../lib/api';
import type { Message } from '../types/messages';
import type { Character } from '../types/characters';
import { CreatePostForm } from './CreatePostForm';
import { PostCard } from './PostCard';

interface CommonRoomProps {
  gameId: number;
  phaseId?: number;
  phaseTitle?: string;
  isCurrentPhase?: boolean;
  isGM?: boolean;
}

export function CommonRoom({ gameId, phaseId, phaseTitle, isCurrentPhase = true, isGM = false }: CommonRoomProps) {
  const [posts, setPosts] = useState<Message[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreatingPost, setIsCreatingPost] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<number | undefined>(undefined);

  // Decode JWT to get user_id
  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        setCurrentUserId(payload.user_id);
      } catch (err) {
        console.error('Failed to decode token:', err);
      }
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [gameId, phaseId]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load posts and user's controllable characters in parallel
      const [postsResponse, charactersResponse] = await Promise.all([
        apiClient.getGamePosts(gameId, { phase_id: phaseId, limit: 50, offset: 0 }),
        apiClient.getUserControllableCharacters(gameId)
      ]);

      setPosts(postsResponse.data);
      setCharacters(charactersResponse.data);
    } catch (err) {
      console.error('Failed to load Common Room data:', err);
      setError('Failed to load Common Room. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePost = async (characterId: number, content: string) => {
    try {
      setIsCreatingPost(true);
      await apiClient.createPost(gameId, {
        character_id: characterId,
        content,
        phase_id: phaseId
      });
      // Reload posts to show the new one
      await loadData();
    } catch (err) {
      console.error('Failed to create post:', err);
      throw new Error('Failed to create post. Please try again.');
    } finally {
      setIsCreatingPost(false);
    }
  };

  const handleCreateComment = async (postId: number, characterId: number, content: string) => {
    try {
      await apiClient.createComment(gameId, postId, {
        character_id: characterId,
        content
      });
      // Don't reload all posts - let the individual PostCard/ThreadedComment handle the update
      // This prevents jarring full-page reloads when commenting deep in a thread
    } catch (err) {
      console.error('Failed to create comment:', err);
      throw new Error('Failed to create comment. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <h3 className="text-red-800 font-semibold mb-2">Error</h3>
        <p className="text-red-700">{error}</p>
        <button
          onClick={loadData}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-full">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Common Room{phaseTitle && ` - ${phaseTitle}`}
        </h2>
        <p className="text-gray-600">
          {isCurrentPhase
            ? isGM
              ? 'Create GM posts to share information, updates, and phase details with all players. Players can comment and discuss below your posts.'
              : 'View GM posts and join the discussion. Comment on posts to interact with other players.'
            : 'Historical discussions from this phase. New posts can only be created by the GM in the current phase.'}
        </p>
      </div>

      {/* Create Post Form - only show for current phase and GM */}
      {isCurrentPhase && isGM && (
        <CreatePostForm
          gameId={gameId}
          characters={characters}
          onSubmit={handleCreatePost}
          isSubmitting={isCreatingPost}
        />
      )}

      {/* Posts Feed */}
      {posts.length === 0 ? (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
          <svg
            className="mx-auto h-12 w-12 text-gray-400 mb-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
          <h3 className="text-lg font-medium text-gray-900 mb-1">No posts yet</h3>
          <p className="text-gray-600">Be the first to start a conversation!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              gameId={gameId}
              characters={characters}
              onCreateComment={handleCreateComment}
              currentUserId={currentUserId}
            />
          ))}
        </div>
      )}
    </div>
  );
}
