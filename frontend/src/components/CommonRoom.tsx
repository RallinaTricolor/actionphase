import { useState, useEffect, lazy, Suspense } from 'react';
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
import { usePollsByPhase } from '../hooks';
import { logger } from '@/services/LoggingService';

// Lazy load PollsTab component
const PollsTab = lazy(() => import('./PollsTab').then(m => ({ default: m.PollsTab })));

interface CommonRoomProps {
  gameId: number;
  phaseId?: number;
  phaseTitle?: string;
  phaseDescription?: string;
  currentPhase?: GamePhase | null;
  isCurrentPhase?: boolean;
  isGM?: boolean;
  isAudience?: boolean;
}

export function CommonRoom({ gameId, phaseId, phaseTitle, phaseDescription, currentPhase, isCurrentPhase = true, isGM = false, isAudience = false }: CommonRoomProps) {
  // Get current user from AuthContext
  const { currentUser } = useAuth();
  const currentUserId = currentUser?.id;

  // URL search params for deep linking to comments and sub-tab navigation
  const [searchParams, setSearchParams] = useSearchParams();
  const commentIdParam = searchParams.get('comment');
  const viewParam = searchParams.get('view') as 'posts' | 'newComments' | 'polls' | null;

  const [posts, setPosts] = useState<Message[]>([]);
  const [controllableCharacters, setControllableCharacters] = useState<Character[]>([]);
  const [allCharacters, setAllCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreatingPost, setIsCreatingPost] = useState(false);
  const [threadModalComment, setThreadModalComment] = useState<Message | null>(null);
  const [threadModalContext, setThreadModalContext] = useState<{
    parentChain: Message[];
    hasFullThread: boolean;
    targetCommentId: number;
  } | null>(null);
  // Initialize activeTab from URL parameter, default to 'posts'
  const [activeTab, setActiveTab] = useState<'posts' | 'newComments' | 'polls'>(viewParam || 'posts');
  const navigate = useNavigate();

  // Fetch polls to calculate unvoted count for badge (phase-specific)
  const { data: polls = [], isLoading: pollsLoading } = usePollsByPhase(gameId, phaseId || 0);
  const unvotedPollsCount = polls.filter(poll => !poll.user_has_voted).length;

  // Fetch previous phase results (if applicable)
  const previousPhaseResults = usePreviousPhaseResults(gameId, currentPhase, isGM);

  useEffect(() => {
    loadData();
  }, [gameId, phaseId]);

  // Sync activeTab state with URL parameter
  useEffect(() => {
    const currentView = searchParams.get('view') as 'posts' | 'newComments' | 'polls' | null;
    if (currentView && currentView !== activeTab) {
      setActiveTab(currentView);
    } else if (!currentView && activeTab !== 'posts') {
      // Default to 'posts' if no view parameter
      setActiveTab('posts');
    }
  }, [searchParams]);

  // Auto-scroll to comment from URL parameter
  useEffect(() => {
    if (!commentIdParam || loading) return;

    // If there's a comment parameter, ensure we're on the 'posts' tab
    if (activeTab !== 'posts') {
      // Update both state and URL parameter (replace current URL to avoid extra history entry)
      setActiveTab('posts');
      const newParams = new URLSearchParams(searchParams);
      newParams.set('view', 'posts');
      setSearchParams(newParams, { replace: true }); // Replace to avoid extra history entry
      return; // Let the tab switch complete, then the effect will re-run
    }

    // Wait for DOM to be ready, then try to scroll to comment
    const timer = setTimeout(async () => {
      // Try to find comment with various ID patterns (base, -desktop, -mobile)
      // Root comments use base ID, nested comments may have -desktop/-mobile suffix
      let element = document.getElementById(`comment-${commentIdParam}`) ||
                    document.getElementById(`comment-${commentIdParam}-desktop`) ||
                    document.getElementById(`comment-${commentIdParam}-mobile`);

      if (element) {
        // Comment is visible in the DOM - scroll to it
        element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });

        // Add bordered box styling to match modal appearance
        element.classList.add('ring-2', 'ring-interactive-primary', 'rounded-lg', 'p-1');

        // Remove after 5 seconds
        setTimeout(() => {
          element.classList.remove('ring-2', 'ring-interactive-primary', 'rounded-lg', 'p-1');
        }, 5000);

        // Clear the comment parameter from URL after scrolling
        const newParams = new URLSearchParams(searchParams);
        newParams.delete('comment');
        setSearchParams(newParams, { replace: true });
      } else {
        // Comment not found in DOM - likely nested deep (beyond depth 5)
        // Fetch the comment and open it in ThreadViewModal
        logger.debug('Comment not found in DOM, fetching and opening modal', { commentId: commentIdParam, gameId });

        const fetchAndShowComment = async () => {
          try {
            // Fetch the comment with parent context (2-3 levels)
            const { fetchCommentWithParents } = await import('../utils/threadUtils');
            const { messages, hasFullThread } = await fetchCommentWithParents(
              gameId,
              parseInt(commentIdParam),
              3 // Fetch up to 3 parent levels for context
            );

            if (messages.length === 0) {
              throw new Error('No messages fetched');
            }

            // The target comment is the last one in the array
            const targetComment = messages[messages.length - 1];

            // Store the comment and its context for the modal
            setThreadModalComment(targetComment);
            setThreadModalContext({
              parentChain: messages,
              hasFullThread,
              targetCommentId: parseInt(commentIdParam)
            });

            // Clear the comment parameter from URL
            const newParams = new URLSearchParams(searchParams);
            newParams.delete('comment');
            setSearchParams(newParams, { replace: true });
          } catch (err) {
            logger.error('Failed to fetch comment for modal', { error: err, commentId: commentIdParam, gameId });
            // If fetch fails, clear the comment parameter and show error
            const newParams = new URLSearchParams(searchParams);
            newParams.delete('comment');
            setSearchParams(newParams, { replace: true });
            setError('Failed to load comment. The comment may have been deleted.');
          }
        };

        fetchAndShowComment();
      }
    }, 500); // Wait for comments to load and expand

    return () => clearTimeout(timer);
  }, [commentIdParam, loading, searchParams, setSearchParams, gameId, navigate, activeTab]);

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
      logger.error('Failed to load Common Room data', { error: err, gameId, phaseId });
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
      logger.error('Failed to create post', { error: err, gameId, characterId, phaseId });
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
      logger.error('Failed to create comment', { error: err, gameId, postId, characterId });
      throw new Error('Failed to create comment. Please try again.');
    }
  };

  const handlePostUpdated = (updatedPost: Message) => {
    // Update the post in the local state to reflect the edit
    setPosts(prevPosts =>
      prevPosts.map(post =>
        post.id === updatedPost.id ? updatedPost : post
      )
    );
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
            <h3 className="text-sm font-semibold text-content-primary mb-2">Phase Description</h3>
            <MarkdownPreview content={phaseDescription} />
          </Card>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-border-primary mb-6">
        <nav className="flex space-x-6 md:space-x-8">
          <button
            onClick={() => {
              const newParams = new URLSearchParams(searchParams);
              newParams.set('view', 'posts');
              setSearchParams(newParams, { replace: false });
            }}
            className={`py-3 md:py-2 px-1 border-b-[3px] md:border-b-2 font-semibold md:font-medium text-base md:text-sm transition-colors ${
              activeTab === 'posts'
                ? 'border-accent-primary text-interactive-primary'
                : 'border-transparent text-text-secondary hover:text-text-primary hover:border-border-secondary'
            }`}
          >
            Posts
          </button>
          <button
            onClick={() => {
              const newParams = new URLSearchParams(searchParams);
              newParams.set('view', 'newComments');
              setSearchParams(newParams, { replace: false });
            }}
            className={`py-3 md:py-2 px-1 border-b-[3px] md:border-b-2 font-semibold md:font-medium text-base md:text-sm transition-colors ${
              activeTab === 'newComments'
                ? 'border-accent-primary text-interactive-primary'
                : 'border-transparent text-text-secondary hover:text-text-primary hover:border-border-secondary'
            }`}
          >
            New Comments
          </button>
          <button
            onClick={() => {
              const newParams = new URLSearchParams(searchParams);
              newParams.set('view', 'polls');
              setSearchParams(newParams, { replace: false });
            }}
            className={`py-3 md:py-2 px-1 border-b-[3px] md:border-b-2 font-semibold md:font-medium text-base md:text-sm transition-colors ${
              activeTab === 'polls'
                ? 'border-accent-primary text-interactive-primary'
                : 'border-transparent text-text-secondary hover:text-text-primary hover:border-border-secondary'
            }`}
          >
            Polls {unvotedPollsCount > 0 && !pollsLoading && (
              <span className="ml-1 inline-flex items-center justify-center px-2 py-0.5 text-xs font-medium rounded-full bg-accent-primary text-white">
                {unvotedPollsCount}
              </span>
            )}
          </button>
        </nav>
      </div>

      {/* Recent Results Section - only for current phase and players (not GMs) */}
      {isCurrentPhase && !isGM && previousPhaseResults.shouldShowResults && (
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
                  onPostUpdated={handlePostUpdated}
                  currentUserId={currentUserId}
                  data-testid={`post-${post.id}`}
                  readOnly={!isCurrentPhase}
                />
              ))}
            </div>
          )}
        </>
      ) : activeTab === 'newComments' ? (
        /* New Comments View */
        <NewCommentsView gameId={gameId} />
      ) : (
        /* Polls Tab */
        <Suspense fallback={<div className="flex justify-center py-8"><Spinner size="lg" label="Loading polls..." /></div>}>
          <PollsTab gameId={gameId} phaseId={phaseId} isGM={isGM} isCurrentPhase={isCurrentPhase} isAudience={isAudience} />
        </Suspense>
      )}

      {/* Thread View Modal for deep-linked comments */}
      {threadModalComment && (
        <ThreadViewModal
          gameId={gameId}
          postId={getRootPostId(threadModalComment)} // Calculate root post ID from comment
          comment={threadModalComment}
          characters={allCharacters}
          controllableCharacters={controllableCharacters}
          onClose={() => {
            setThreadModalComment(null);
            setThreadModalContext(null);
          }}
          onCreateReply={handleCreateComment}
          currentUserId={currentUserId}
          parentChain={threadModalContext?.parentChain}
          hasFullThread={threadModalContext?.hasFullThread}
          targetCommentId={threadModalContext?.targetCommentId}
          readOnly={!isCurrentPhase}
        />
      )}
    </div>
  );
}
