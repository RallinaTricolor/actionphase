import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { apiClient } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { Button, Alert, Spinner, Card } from './ui';
import type { Message } from '../types/messages';
import type { Character } from '../types/characters';
import type { GamePhase } from '../types/phases';
import { CreatePostForm } from './CreatePostForm';
import { PostCard } from './PostCard';
import { ThreadViewModal } from './ThreadViewModal';
import { NewCommentsView } from './NewCommentsView';
import { MarkdownPreview } from './MarkdownPreview';
import { RecentResultsSection } from './RecentResultsSection';
import { usePreviousPhaseResults } from '../hooks/usePreviousPhaseResults';
import { getRootPostId } from '../utils/commentUtils';

interface CommonRoomProps {
  gameId: number;
  phaseId?: number;
  phaseTitle?: string;
  phaseDescription?: string;
  currentPhase?: GamePhase | null;
  isCurrentPhase?: boolean;
  isGM?: boolean;
}

export function CommonRoom({ gameId, phaseId, phaseTitle, phaseDescription, currentPhase, isCurrentPhase = true, isGM = false }: CommonRoomProps) {
  // Get current user from AuthContext
  const { currentUser } = useAuth();
  const currentUserId = currentUser?.id;

  // URL search params for deep linking to comments
  const [searchParams, setSearchParams] = useSearchParams();
  const commentIdParam = searchParams.get('comment');

  const [posts, setPosts] = useState<Message[]>([]);
  const [controllableCharacters, setControllableCharacters] = useState<Character[]>([]);
  const [allCharacters, setAllCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreatingPost, setIsCreatingPost] = useState(false);
  const [threadModalComment, setThreadModalComment] = useState<Message | null>(null);
  const [activeTab, setActiveTab] = useState<'posts' | 'newComments'>('posts');
  const navigate = useNavigate();

  // Fetch previous phase results (if applicable)
  const previousPhaseResults = usePreviousPhaseResults(gameId, currentPhase, isGM);

  useEffect(() => {
    loadData();
  }, [gameId, phaseId]);

  // Auto-scroll to comment from URL parameter
  useEffect(() => {
    if (!commentIdParam || loading) return;

    // Wait for DOM to be ready, then try to scroll to comment
    const timer = setTimeout(async () => {
      const element = document.getElementById(`comment-${commentIdParam}`);
      if (element) {
        // Comment is visible in the DOM - scroll to it
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });

        // Highlight the comment briefly
        element.classList.add('ring-4', 'ring-semantic-warning', 'ring-opacity-75');
        setTimeout(() => {
          element.classList.remove('ring-4', 'ring-semantic-warning', 'ring-opacity-75');
        }, 3000);

        // Clear the comment parameter from URL after scrolling
        const newParams = new URLSearchParams(searchParams);
        newParams.delete('comment');
        setSearchParams(newParams, { replace: true });
      } else {
        // Comment not found in DOM - likely nested deep (beyond depth 5)
        // Fetch the comment and open it in ThreadViewModal
        console.log(`[CommonRoom] Comment ${commentIdParam} not found in DOM, fetching and opening modal...`);

        const fetchAndShowComment = async () => {
          try {
            // Fetch the specific comment (or nested comment)
            const response = await apiClient.messages.getMessage(gameId, parseInt(commentIdParam));
            const comment = response.data;

            // Open the comment in ThreadViewModal
            setThreadModalComment(comment);

            // Clear the comment parameter from URL
            const newParams = new URLSearchParams(searchParams);
            newParams.delete('comment');
            setSearchParams(newParams, { replace: true });
          } catch (err) {
            console.error(`[CommonRoom] Failed to fetch comment ${commentIdParam}:`, err);
            // If fetch fails, navigate to ThreadViewPage as fallback
            navigate(`/games/${gameId}/common-room/thread/${commentIdParam}`);
          }
        };

        fetchAndShowComment();
      }
    }, 500); // Wait for comments to load and expand

    return () => clearTimeout(timer);
  }, [commentIdParam, loading, searchParams, setSearchParams, gameId, navigate]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load posts, user's controllable characters, and all game characters in parallel
      const [postsResponse, controllableCharsResponse, allCharsResponse] = await Promise.all([
        apiClient.messages.getGamePosts(gameId, { phase_id: phaseId, limit: 50, offset: 0 }),
        apiClient.characters.getUserControllableCharacters(gameId),
        apiClient.characters.getGameCharacters(gameId)
      ]);

      setPosts(postsResponse.data);
      setControllableCharacters(controllableCharsResponse.data);
      setAllCharacters(allCharsResponse.data);
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
      await apiClient.messages.createPost(gameId, {
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
      await apiClient.messages.createComment(gameId, postId, {
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
        <Spinner size="lg" label="Loading Common Room..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Alert variant="danger" title="Error">
          {error}
        </Alert>
        <Button variant="danger" onClick={loadData}>
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-full" data-testid="common-room-container">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-content-primary mb-2">
          Common Room{phaseTitle && ` - ${phaseTitle}`}
        </h2>
        <p className="text-content-secondary">
          {isCurrentPhase
            ? isGM
              ? 'Create GM posts to share information, updates, and phase details with all players. Players can comment and discuss below your posts.'
              : 'View GM posts and join the discussion. Comment on posts to interact with other players.'
            : 'Historical discussions from this phase. New posts can only be created by the GM in the current phase.'}
        </p>

        {/* Phase Description */}
        {phaseDescription && (
          <Card variant="bordered" padding="sm" className="mt-4">
            <MarkdownPreview content={phaseDescription} />
          </Card>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-border-primary mb-6">
        <nav className="flex space-x-8">
          <button
            onClick={() => setActiveTab('posts')}
            className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'posts'
                ? 'border-accent-primary text-accent-primary'
                : 'border-transparent text-text-secondary hover:text-text-primary hover:border-border-secondary'
            }`}
          >
            Posts
          </button>
          <button
            onClick={() => setActiveTab('newComments')}
            className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'newComments'
                ? 'border-accent-primary text-accent-primary'
                : 'border-transparent text-text-secondary hover:text-text-primary hover:border-border-secondary'
            }`}
          >
            New Comments
          </button>
        </nav>
      </div>

      {/* Recent Results Section - only for current phase */}
      {isCurrentPhase && previousPhaseResults.shouldShowResults && (
        <RecentResultsSection
          gameId={gameId}
          results={previousPhaseResults.results}
          previousPhaseId={previousPhaseResults.previousPhaseId!}
          previousPhaseTitle={previousPhaseResults.previousPhaseTitle!}
        />
      )}

      {/* Tab Content */}
      {activeTab === 'posts' ? (
        <>
          {/* Create Post Form - only show for current phase and GM */}
          {isCurrentPhase && isGM && (
            <CreatePostForm
              gameId={gameId}
              characters={controllableCharacters}
              allCharacters={allCharacters}
              onSubmit={handleCreatePost}
              isSubmitting={isCreatingPost}
              shouldStartCollapsed={posts.length > 0}
            />
          )}

          {/* Posts Feed */}
          {posts.length === 0 ? (
            <div className="surface-raised border border-theme-default rounded-lg p-8 text-center">
              <svg
                className="mx-auto h-12 w-12 text-content-tertiary mb-3"
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
              <h3 className="text-lg font-medium text-content-primary mb-1">No posts yet</h3>
              <p className="text-content-secondary">Be the first to start a conversation!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {posts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  gameId={gameId}
                  characters={allCharacters}
                  controllableCharacters={controllableCharacters}
                  onCreateComment={handleCreateComment}
                  currentUserId={currentUserId}
                  data-testid={`post-${post.id}`}
                  readOnly={!isCurrentPhase}
                />
              ))}
            </div>
          )}
        </>
      ) : (
        /* New Comments View */
        <NewCommentsView gameId={gameId} />
      )}

      {/* Thread View Modal for deep-linked comments */}
      {threadModalComment && (
        <ThreadViewModal
          gameId={gameId}
          postId={getRootPostId(threadModalComment)} // Calculate root post ID from comment
          comment={threadModalComment}
          characters={allCharacters}
          controllableCharacters={controllableCharacters}
          onClose={() => setThreadModalComment(null)}
          onCreateReply={handleCreateComment}
          currentUserId={currentUserId}
        />
      )}
    </div>
  );
}
