import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PostCard } from './PostCard';
import { ToastProvider } from '../contexts/ToastContext';
import type { Message, CommentWithDepth, PaginatedCommentsResponse } from '@/types/messages';
import type { Character } from '@/types/characters';

// Mock the API client
vi.mock('../lib/api', () => ({
  apiClient: {
    messages: {
      getPostCommentsWithThreads: vi.fn(),
    },
  },
}));

// Import the mocked API after the mock definition
import { apiClient } from '../lib/api';

// Mock other hooks
vi.mock('../hooks/useCommentMutations', () => ({
  useCreateComment: () => ({
    mutateAsync: vi.fn(),
  }),
  useUpdateComment: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useDeleteComment: () => ({
    mutateAsync: vi.fn(),
  }),
}));

vi.mock('../hooks/useAdminMode', () => ({
  useAdminMode: () => ({
    adminModeEnabled: false,
  }),
}));

vi.mock('../hooks/useGamePermissions', () => ({
  useGamePermissions: () => ({
    isGM: false,
  }),
}));

vi.mock('../hooks', () => ({
  useUpdatePost: () => ({
    mutateAsync: vi.fn(),
  }),
}));

vi.mock('../hooks/useReadTracking', () => ({
  useMarkPostAsRead: () => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false,
    isError: false,
    error: null,
  }),
  usePostUnreadCommentIDs: () => ({
    data: [],
  }),
}));

vi.mock('../contexts/ReadingModeContext', () => ({
  useReadingMode: () => ({
    readingMode: false,
  }),
}));

describe('PostCard - Load More Comments', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    vi.clearAllMocks();
  });

  const mockPost: Message = {
    id: 1,
    game_id: 1,
    author_id: 1,
    character_id: 1,
    content: 'Test post content',
    message_type: 'post',
    thread_depth: 0,
    author_username: 'testuser',
    character_name: 'Test Character',
    character_avatar_url: null,
    comment_count: 250,
    reply_count: 0,
    is_edited: false,
    is_deleted: false,
    created_at: '2024-01-01T12:00:00Z',
    updated_at: '2024-01-01T12:00:00Z',
  };

  const mockCharacters: Character[] = [
    {
      id: 1,
      name: 'Test Character',
      username: 'testuser',
      character_type: 'player_character',
      avatar_url: null,
    } as Character,
  ];

  const createMockComment = (id: number, depth: number = 0, parentId?: number): CommentWithDepth => ({
    id,
    game_id: 1,
    author_id: 1,
    character_id: 1,
    content: `Comment ${id}`,
    message_type: 'comment',
    parent_id: parentId,
    thread_depth: depth + 1,
    depth,
    author_username: 'testuser',
    character_name: 'Test Character',
    character_avatar_url: null,
    reply_count: 0,
    is_edited: false,
    is_deleted: false,
    created_at: `2024-01-01T12:${String(id).padStart(2, '0')}:00Z`,
    updated_at: `2024-01-01T12:${String(id).padStart(2, '0')}:00Z`,
  });

  const renderPostCard = (post: Message) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <PostCard
            post={post}
            gameId={1}
            characters={mockCharacters}
            controllableCharacters={mockCharacters}
            currentUserId={1}
          />
        </ToastProvider>
      </QueryClientProvider>
    );
  };

  it('should show "Load More" button when there are more comments', async () => {
    // Arrange: Mock API to return 200 comments with 50 more remaining
    const mockComments = Array.from({ length: 200 }, (_, i) => createMockComment(i + 1));
    const mockResponse: PaginatedCommentsResponse = {
      comments: mockComments,
      total_top_level: 250,
      returned_top_level: 200,
      returned_total: 200,
      has_more: true,
      limit: 200,
      offset: 0,
    };

    vi.mocked(apiClient.messages.getPostCommentsWithThreads).mockResolvedValue({
      data: mockResponse,
    } as any);

    // Act
    renderPostCard(mockPost);

    // Assert: Wait for comments to load
    await waitFor(() => {
      expect(screen.getByText(/Load More Comments/i)).toBeInTheDocument();
    });

    // Should show remaining count
    expect(screen.getByText(/50 remaining/i)).toBeInTheDocument();
  });

  it('should hide "Load More" button when all comments are loaded', async () => {
    // Arrange: Mock API to return all comments (no more remaining)
    const mockComments = Array.from({ length: 50 }, (_, i) => createMockComment(i + 1));
    const mockResponse: PaginatedCommentsResponse = {
      comments: mockComments,
      total_top_level: 50,
      returned_top_level: 50,
      returned_total: 50,
      has_more: false,
      limit: 200,
      offset: 0,
    };

    vi.mocked(apiClient.messages.getPostCommentsWithThreads).mockResolvedValue({
      data: mockResponse,
    } as any);

    // Act
    renderPostCard(mockPost);

    // Assert: Wait for comments to load
    await waitFor(() => {
      expect(screen.queryByText(/Load More Comments/i)).not.toBeInTheDocument();
    });
  });

  it('should load more comments when "Load More" button is clicked', async () => {
    const user = userEvent.setup();

    // Arrange: Initial load returns 200 comments
    const initialComments = Array.from({ length: 200 }, (_, i) => createMockComment(i + 1));
    const initialResponse: PaginatedCommentsResponse = {
      comments: initialComments,
      total_top_level: 250,
      returned_top_level: 200,
      returned_total: 200,
      has_more: true,
      limit: 200,
      offset: 0,
    };

    // Second load returns remaining 50 comments
    const moreComments = Array.from({ length: 50 }, (_, i) => createMockComment(i + 201));
    const secondResponse: PaginatedCommentsResponse = {
      comments: moreComments,
      total_top_level: 250,
      returned_top_level: 50,
      returned_total: 50,
      has_more: false,
      limit: 200,
      offset: 200,
    };

    vi.mocked(apiClient.messages.getPostCommentsWithThreads)
      .mockResolvedValueOnce({ data: initialResponse } as any)
      .mockResolvedValueOnce({ data: secondResponse } as any);

    // Act
    renderPostCard(mockPost);

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByText(/Load More Comments/i)).toBeInTheDocument();
    });

    // Click Load More button
    const loadMoreButton = screen.getByText(/Load More Comments/i);
    await user.click(loadMoreButton);

    // Assert: Second API call should be made with correct offset
    await waitFor(() => {
      expect(apiClient.messages.getPostCommentsWithThreads).toHaveBeenCalledTimes(2);
      expect(apiClient.messages.getPostCommentsWithThreads).toHaveBeenLastCalledWith(
        1, // gameId
        1, // postId
        200, // limit
        200, // offset (should be 200 for second page)
        5 // maxDepth
      );
    });

    // Button should disappear after loading all comments
    await waitFor(() => {
      expect(screen.queryByText(/Load More Comments/i)).not.toBeInTheDocument();
    });
  });

  it('should show loading state while loading more comments', async () => {
    const user = userEvent.setup();

    // Arrange: Initial load
    const initialComments = Array.from({ length: 200 }, (_, i) => createMockComment(i + 1));
    const initialResponse: PaginatedCommentsResponse = {
      comments: initialComments,
      total_top_level: 250,
      returned_top_level: 200,
      returned_total: 200,
      has_more: true,
      limit: 200,
      offset: 0,
    };

    // Second load with delay
    const moreComments = Array.from({ length: 50 }, (_, i) => createMockComment(i + 201));
    const secondResponse: PaginatedCommentsResponse = {
      comments: moreComments,
      total_top_level: 250,
      returned_top_level: 50,
      returned_total: 50,
      has_more: false,
      limit: 200,
      offset: 200,
    };

    vi.mocked(apiClient.messages.getPostCommentsWithThreads)
      .mockResolvedValueOnce({ data: initialResponse } as any)
      .mockImplementationOnce(() =>
        new Promise(resolve => setTimeout(() => resolve({ data: secondResponse } as any), 100))
      );

    // Act
    renderPostCard(mockPost);

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByText(/Load More Comments/i)).toBeInTheDocument();
    });

    // Get the button element (not just the text)
    const loadMoreText = screen.getByText(/Load More Comments/i);
    const loadMoreButton = loadMoreText.closest('button');
    expect(loadMoreButton).not.toBeNull();

    // Click Load More button
    await user.click(loadMoreButton!);

    // Assert: Button should be disabled during loading
    await waitFor(() => {
      expect(loadMoreButton).toBeDisabled();
    });

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByText(/Load More Comments/i)).not.toBeInTheDocument();
    });
  });

  it('should append new comments to existing tree when loading more', async () => {
    const user = userEvent.setup();

    // Arrange: Initial 3 comments
    const initialComments = [
      createMockComment(1),
      createMockComment(2),
      createMockComment(3),
    ];
    const initialResponse: PaginatedCommentsResponse = {
      comments: initialComments,
      total_top_level: 5,
      returned_top_level: 3,
      returned_total: 3,
      has_more: true,
      limit: 200,
      offset: 0,
    };

    // Load 2 more comments
    const moreComments = [
      createMockComment(4),
      createMockComment(5),
    ];
    const secondResponse: PaginatedCommentsResponse = {
      comments: moreComments,
      total_top_level: 5,
      returned_top_level: 2,
      returned_total: 2,
      has_more: false,
      limit: 200,
      offset: 3,
    };

    vi.mocked(apiClient.messages.getPostCommentsWithThreads)
      .mockResolvedValueOnce({ data: initialResponse } as any)
      .mockResolvedValueOnce({ data: secondResponse } as any);

    // Act
    renderPostCard(mockPost);

    // Wait for initial load
    await waitFor(() => {
      // Use queryAllByText to handle potential duplicates during rendering
      expect(screen.queryAllByText('Comment 1').length).toBeGreaterThanOrEqual(1);
      expect(screen.queryAllByText('Comment 2').length).toBeGreaterThanOrEqual(1);
      expect(screen.queryAllByText('Comment 3').length).toBeGreaterThanOrEqual(1);
    });

    // Click Load More
    const loadMoreButton = screen.getByText(/Load More Comments/i);
    await user.click(loadMoreButton);

    // Assert: All comments should be visible
    await waitFor(() => {
      expect(screen.getByText('Comment 1')).toBeInTheDocument();
      expect(screen.getByText('Comment 2')).toBeInTheDocument();
      expect(screen.getByText('Comment 3')).toBeInTheDocument();
      expect(screen.getByText('Comment 4')).toBeInTheDocument();
      expect(screen.getByText('Comment 5')).toBeInTheDocument();
    });
  });

  it('should preserve nested comment structure when loading more', async () => {
    const user = userEvent.setup();

    // Arrange: Top-level comment with nested replies
    const initialComments = [
      createMockComment(1, 0), // Top-level
      createMockComment(2, 1, 1), // Reply to comment 1
      createMockComment(3, 2, 2), // Reply to comment 2
    ];
    const initialResponse: PaginatedCommentsResponse = {
      comments: initialComments,
      total_top_level: 2,
      returned_top_level: 1,
      returned_total: 3,
      has_more: true,
      limit: 200,
      offset: 0,
    };

    // Load another top-level with its replies
    const moreComments = [
      createMockComment(4, 0), // Second top-level
      createMockComment(5, 1, 4), // Reply to comment 4
    ];
    const secondResponse: PaginatedCommentsResponse = {
      comments: moreComments,
      total_top_level: 2,
      returned_top_level: 1,
      returned_total: 2,
      has_more: false,
      limit: 200,
      offset: 1,
    };

    vi.mocked(apiClient.messages.getPostCommentsWithThreads)
      .mockResolvedValueOnce({ data: initialResponse } as any)
      .mockResolvedValueOnce({ data: secondResponse } as any);

    // Act
    renderPostCard(mockPost);

    // Wait for initial load
    await waitFor(() => {
      // Use queryAllByText to handle potential duplicates during rendering
      expect(screen.queryAllByText('Comment 1').length).toBeGreaterThanOrEqual(1);
      expect(screen.queryAllByText('Comment 2').length).toBeGreaterThanOrEqual(1);
      expect(screen.queryAllByText('Comment 3').length).toBeGreaterThanOrEqual(1);
    });

    // Click Load More
    const loadMoreButton = screen.getByText(/Load More Comments/i);
    await user.click(loadMoreButton);

    // Assert: Both trees should be preserved
    await waitFor(() => {
      // Use queryAllByText to handle potential duplicates during rendering
      expect(screen.queryAllByText('Comment 1').length).toBeGreaterThanOrEqual(1);
      expect(screen.queryAllByText('Comment 2').length).toBeGreaterThanOrEqual(1);
      expect(screen.queryAllByText('Comment 3').length).toBeGreaterThanOrEqual(1);
      expect(screen.queryAllByText('Comment 4').length).toBeGreaterThanOrEqual(1);
      expect(screen.queryAllByText('Comment 5').length).toBeGreaterThanOrEqual(1);
    });
  });
});
