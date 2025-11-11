import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThreadedComment } from './ThreadedComment';
import type { Message, Character } from '../types';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '../contexts/ToastContext';
import { apiClient } from '../lib/api';

// Mock the API client
vi.mock('../lib/api', () => ({
  apiClient: {
    messages: {
      getPostComments: vi.fn(),
      createComment: vi.fn(),
    },
  },
}));

// Mock the logger
vi.mock('@/services/LoggingService', () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock hooks
vi.mock('../hooks/useAdminMode', () => ({
  useAdminMode: () => ({ isAdminMode: false }),
}));

vi.mock('../hooks/useCommentMutations', () => ({
  useUpdateComment: () => ({
    mutate: vi.fn(),
  }),
  useDeleteComment: () => ({
    mutate: vi.fn(),
  }),
}));

vi.mock('../hooks/useGamePermissions', () => ({
  useGamePermissions: () => ({
    isGM: false,
    isCoGM: false,
    canManageCharacters: false,
  }),
}));

// Mock GameContext
vi.mock('../contexts/GameContext', () => ({
  useGame: () => ({
    gameId: 1,
    game: null,
    isLoading: false,
  }),
}));

// Helper to create test wrapper
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>{children}</ToastProvider>
    </QueryClientProvider>
  );
}

// Test data factories
const createMockComment = (overrides?: Partial<Message>): Message => ({
  id: 1,
  game_id: 1,
  parent_id: null,
  post_id: 1,
  character_id: 1,
  author_id: 1,
  author_username: 'testuser',
  character_name: 'Test Character',
  character_avatar_url: undefined,
  content: 'Test comment',
  message_type: 'comment',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  reply_count: 0,
  is_deleted: false,
  is_edited: false,
  ...overrides,
});

const createMockCharacter = (overrides?: Partial<Character>): Character => ({
  id: 1,
  game_id: 1,
  user_id: 1,
  username: 'testuser',
  name: 'Test Character',
  character_type: 'player_character',
  avatar_url: undefined,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  ...overrides,
});

describe('ThreadedComment - Depth Limiting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Continue Thread Button Display', () => {
    it('should NOT show "Continue thread" button at depth 0-3', async () => {
      const comment = createMockComment({ reply_count: 1 });

      await act(async () => {
        render(
          <ThreadedComment
            comment={comment}
            gameId={1}
            postId={1}
            characters={[]}
            controllableCharacters={[]}
            onCreateReply={vi.fn()}
            depth={3}
            maxDepth={5}
          />,
          { wrapper: createWrapper() }
        );
      });

      expect(screen.queryByText(/Continue this thread/i)).not.toBeInTheDocument();
    });

    it('should show "Continue thread" button at depth maxDepth-1 (depth 4) when replies exist', () => {
      const comment = createMockComment({ reply_count: 2 });

      render(
        <ThreadedComment
          comment={comment}
          gameId={1}
          postId={1}
          characters={[]}
          controllableCharacters={[]}
          onCreateReply={vi.fn()}
          depth={4} // maxDepth - 1
          maxDepth={5}
        />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByText(/Continue this thread/i)).toBeInTheDocument();
      expect(screen.getByText(/2 replies/i)).toBeInTheDocument();
    });

    it('should NOT show "Continue thread" button at depth maxDepth-1 when NO replies exist', () => {
      const comment = createMockComment({ reply_count: 0 });

      render(
        <ThreadedComment
          comment={comment}
          gameId={1}
          postId={1}
          characters={[]}
          controllableCharacters={[]}
          onCreateReply={vi.fn()}
          depth={4} // maxDepth - 1
          maxDepth={5}
        />,
        { wrapper: createWrapper() }
      );

      expect(screen.queryByText(/Continue this thread/i)).not.toBeInTheDocument();
    });

    it('should show "Continue thread" button on mobile at depth 2 (mobileMaxDepth-1)', () => {
      const comment = createMockComment({ reply_count: 3 });

      // Mock mobile viewport
      window.matchMedia = vi.fn().mockImplementation((query) => ({
        matches: query === '(max-width: 768px)',
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }));

      render(
        <ThreadedComment
          comment={comment}
          gameId={1}
          postId={1}
          characters={[]}
          controllableCharacters={[]}
          onCreateReply={vi.fn()}
          depth={2} // mobileMaxDepth - 1
          maxDepth={5}
        />,
        { wrapper: createWrapper() }
      );

      // Mobile "Continue thread" button should be visible
      const buttons = screen.getAllByText(/Continue this thread/i);
      expect(buttons.length).toBeGreaterThan(0);
    });
  });

  describe('Optimistic Rendering at Max Depth', () => {
    it('should NOT render replies optimistically at depth maxDepth-1', async () => {
      const comment = createMockComment({ reply_count: 0 });
      const character = createMockCharacter();
      const onCreateReply = vi.fn().mockResolvedValue(undefined);

      // Mock API to NOT return new replies
      vi.mocked(apiClient.messages.getPostComments).mockResolvedValue({ data: [] });

      const user = userEvent.setup();

      render(
        <ThreadedComment
          comment={comment}
          gameId={1}
          postId={1}
          characters={[]}
          controllableCharacters={[character]}
          onCreateReply={onCreateReply}
          currentUserId={1}
          depth={4} // maxDepth - 1
          maxDepth={5}
        />,
        { wrapper: createWrapper() }
      );

      // Click Reply button
      await user.click(screen.getByText('Reply'));

      // Type message
      const textarea = screen.getByPlaceholderText(/Write a reply/i);
      await user.type(textarea, 'Test reply at max depth');

      // Submit
      const submitButton = screen.getByRole('button', { name: /^Reply$/i });
      await user.click(submitButton);

      // Wait for submission
      await waitFor(() => {
        expect(onCreateReply).toHaveBeenCalled();
      });

      // Reply should NOT be rendered in the DOM
      expect(screen.queryByText('Test reply at max depth')).not.toBeInTheDocument();

      // But reply count should have incremented
      expect(screen.getByText(/Continue this thread/i)).toBeInTheDocument();
      expect(screen.getByText(/1 reply/i)).toBeInTheDocument();
    });

    it('should render replies optimistically at depth 0-3 (below max depth)', async () => {
      const comment = createMockComment({ reply_count: 0 });
      const character = createMockCharacter();
      const onCreateReply = vi.fn().mockResolvedValue(undefined);

      // Mock API to return the new reply
      const newReply = createMockComment({
        id: 999,
        parent_id: comment.id,
        content: 'New test reply',
      });
      vi.mocked(apiClient.messages.getPostComments).mockResolvedValue({
        data: [newReply]
      });

      const user = userEvent.setup();

      render(
        <ThreadedComment
          comment={comment}
          gameId={1}
          postId={1}
          characters={[]}
          controllableCharacters={[character]}
          onCreateReply={onCreateReply}
          currentUserId={1}
          depth={3} // Below maxDepth - 1
          maxDepth={5}
        />,
        { wrapper: createWrapper() }
      );

      // Click Reply button
      await user.click(screen.getByText('Reply'));

      // Type message
      const textarea = screen.getByPlaceholderText(/Write a reply/i);
      await user.type(textarea, 'New test reply');

      // Submit
      const submitButton = screen.getByRole('button', { name: /^Reply$/i });
      await user.click(submitButton);

      // Wait for submission
      await waitFor(() => {
        expect(onCreateReply).toHaveBeenCalled();
      });

      // Reply SHOULD be rendered in the DOM (optimistically first, then from server)
      await waitFor(() => {
        expect(screen.getByText('New test reply')).toBeInTheDocument();
      });
    });

    it('should skip server reload of replies at depth maxDepth-1', async () => {
      const comment = createMockComment({ reply_count: 0 });
      const character = createMockCharacter();
      const onCreateReply = vi.fn().mockResolvedValue(undefined);

      const user = userEvent.setup();

      render(
        <ThreadedComment
          comment={comment}
          gameId={1}
          postId={1}
          characters={[]}
          controllableCharacters={[character]}
          onCreateReply={onCreateReply}
          currentUserId={1}
          depth={4} // maxDepth - 1
          maxDepth={5}
        />,
        { wrapper: createWrapper() }
      );

      // Click Reply button
      await user.click(screen.getByText('Reply'));

      // Type and submit
      const textarea = screen.getByPlaceholderText(/Write a reply/i);
      await user.type(textarea, 'Test reply');

      const submitButton = screen.getByRole('button', { name: /^Reply$/i });
      await user.click(submitButton);

      // Wait for submission
      await waitFor(() => {
        expect(onCreateReply).toHaveBeenCalled();
      });

      // API should NOT be called to reload replies
      expect(apiClient.messages.getPostComments).not.toHaveBeenCalled();
    });

    it('should reload replies from server at depth 0-3', async () => {
      const comment = createMockComment({ reply_count: 0 });
      const character = createMockCharacter();
      const onCreateReply = vi.fn().mockResolvedValue(undefined);

      const newReply = createMockComment({
        id: 999,
        parent_id: comment.id,
        content: 'Server reply',
      });
      vi.mocked(apiClient.messages.getPostComments).mockResolvedValue({
        data: [newReply]
      });

      const user = userEvent.setup();

      render(
        <ThreadedComment
          comment={comment}
          gameId={1}
          postId={1}
          characters={[]}
          controllableCharacters={[character]}
          onCreateReply={onCreateReply}
          currentUserId={1}
          depth={3} // Below maxDepth - 1
          maxDepth={5}
        />,
        { wrapper: createWrapper() }
      );

      // Click Reply button
      await user.click(screen.getByText('Reply'));

      // Type and submit
      const textarea = screen.getByPlaceholderText(/Write a reply/i);
      await user.type(textarea, 'Server reply');

      const submitButton = screen.getByRole('button', { name: /^Reply$/i });
      await user.click(submitButton);

      // Wait for submission
      await waitFor(() => {
        expect(onCreateReply).toHaveBeenCalled();
      });

      // API SHOULD be called to reload replies
      await waitFor(() => {
        expect(apiClient.messages.getPostComments).toHaveBeenCalledWith(1, comment.id);
      });
    });
  });

  describe('Success Toast on Reply Creation', () => {
    it('should show success toast when reply is created', async () => {
      const comment = createMockComment({ reply_count: 0 });
      const character = createMockCharacter();
      const onCreateReply = vi.fn().mockResolvedValue(undefined);

      const user = userEvent.setup();

      render(
        <ThreadedComment
          comment={comment}
          gameId={1}
          postId={1}
          characters={[]}
          controllableCharacters={[character]}
          onCreateReply={onCreateReply}
          currentUserId={1}
          depth={0}
          maxDepth={5}
        />,
        { wrapper: createWrapper() }
      );

      // Click Reply button
      await user.click(screen.getByText('Reply'));

      // Type and submit
      const textarea = screen.getByPlaceholderText(/Write a reply/i);
      await user.type(textarea, 'Test reply');

      const submitButton = screen.getByRole('button', { name: /^Reply$/i });
      await user.click(submitButton);

      // Wait for success toast
      await waitFor(() => {
        expect(screen.getByText('Reply posted successfully')).toBeInTheDocument();
      });
    });

    it('should show error toast when reply creation fails', async () => {
      const comment = createMockComment({ reply_count: 0 });
      const character = createMockCharacter();
      const onCreateReply = vi.fn().mockRejectedValue(new Error('Network error'));

      const user = userEvent.setup();

      render(
        <ThreadedComment
          comment={comment}
          gameId={1}
          postId={1}
          characters={[]}
          controllableCharacters={[character]}
          onCreateReply={onCreateReply}
          currentUserId={1}
          depth={0}
          maxDepth={5}
        />,
        { wrapper: createWrapper() }
      );

      // Click Reply button
      await user.click(screen.getByText('Reply'));

      // Type and submit
      const textarea = screen.getByPlaceholderText(/Write a reply/i);
      await user.type(textarea, 'Test reply');

      const submitButton = screen.getByRole('button', { name: /^Reply$/i });
      await user.click(submitButton);

      // Wait for error toast
      await waitFor(() => {
        expect(screen.getByText('Failed to post reply. Please try again.')).toBeInTheDocument();
      });
    });
  });

  describe('Reply Count Updates', () => {
    it('should increment reply_count immediately when submitting reply at max depth', async () => {
      const comment = createMockComment({ reply_count: 2 });
      const character = createMockCharacter();
      const onCreateReply = vi.fn().mockResolvedValue(undefined);

      const user = userEvent.setup();

      render(
        <ThreadedComment
          comment={comment}
          gameId={1}
          postId={1}
          characters={[]}
          controllableCharacters={[character]}
          onCreateReply={onCreateReply}
          currentUserId={1}
          depth={4} // maxDepth - 1
          maxDepth={5}
        />,
        { wrapper: createWrapper() }
      );

      // Initially shows 2 replies
      expect(screen.getByText(/2 replies/i)).toBeInTheDocument();

      // Click Reply button
      await user.click(screen.getByText('Reply'));

      // Type and submit
      const textarea = screen.getByPlaceholderText(/Write a reply/i);
      await user.type(textarea, 'Test reply');

      const submitButton = screen.getByRole('button', { name: /^Reply$/i });
      await user.click(submitButton);

      // Wait for submission
      await waitFor(() => {
        expect(onCreateReply).toHaveBeenCalled();
      });

      // Should now show 3 replies
      await waitFor(() => {
        expect(screen.getByText(/3 replies/i)).toBeInTheDocument();
      });
    });

    it('should rollback reply_count on error', async () => {
      const comment = createMockComment({ reply_count: 2 });
      const character = createMockCharacter();
      const onCreateReply = vi.fn().mockRejectedValue(new Error('Failed'));

      const user = userEvent.setup();

      render(
        <ThreadedComment
          comment={comment}
          gameId={1}
          postId={1}
          characters={[]}
          controllableCharacters={[character]}
          onCreateReply={onCreateReply}
          currentUserId={1}
          depth={4} // maxDepth - 1
          maxDepth={5}
        />,
        { wrapper: createWrapper() }
      );

      // Initially shows 2 replies
      expect(screen.getByText(/2 replies/i)).toBeInTheDocument();

      // Click Reply button
      await user.click(screen.getByText('Reply'));

      // Type and submit
      const textarea = screen.getByPlaceholderText(/Write a reply/i);
      await user.type(textarea, 'Test reply');

      const submitButton = screen.getByRole('button', { name: /^Reply$/i });
      await user.click(submitButton);

      // Wait for error
      await waitFor(() => {
        expect(screen.getByText('Failed to post reply. Please try again.')).toBeInTheDocument();
      });

      // Should still show 2 replies (rolled back)
      expect(screen.getByText(/2 replies/i)).toBeInTheDocument();
    });
  });

  describe('Reply Count Initialization from Preloaded Children', () => {
    it('should initialize reply_count from preloaded children when reply_count is 0', () => {
      const comment = {
        ...createMockComment({ reply_count: 0 }),
        children: [
          createMockComment({ id: 2 }),
          createMockComment({ id: 3 }),
        ],
      };

      render(
        <ThreadedComment
          comment={comment}
          gameId={1}
          postId={1}
          characters={[]}
          controllableCharacters={[]}
          onCreateReply={vi.fn()}
          depth={0}
          maxDepth={5}
        />,
        { wrapper: createWrapper() }
      );

      // Should show 2 replies from children count
      expect(screen.getByText(/2 replies/i)).toBeInTheDocument();
    });

    it('should NOT override existing reply_count with children length', () => {
      const comment = {
        ...createMockComment({ reply_count: 5 }),
        children: [
          createMockComment({ id: 2 }),
          createMockComment({ id: 3 }),
        ],
      };

      render(
        <ThreadedComment
          comment={comment}
          gameId={1}
          postId={1}
          characters={[]}
          controllableCharacters={[]}
          onCreateReply={vi.fn()}
          depth={0}
          maxDepth={5}
        />,
        { wrapper: createWrapper() }
      );

      // Should show 5 replies (from reply_count, not children.length)
      expect(screen.getByText(/5 replies/i)).toBeInTheDocument();
    });
  });
});
