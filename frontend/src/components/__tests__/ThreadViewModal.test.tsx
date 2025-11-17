import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '../../mocks/server';
import { renderWithProviders } from '../../test-utils/render';
import { ThreadViewModal } from '../ThreadViewModal';
import type { Message } from '../../types/messages';
import type { Character } from '../../types/characters';

describe('ThreadViewModal', () => {
  const mockGameId = 1;
  const mockPostId = 100;
  const mockOnClose = vi.fn();
  const mockOnCreateReply = vi.fn();
  const mockCurrentUserId = 200;

  const mockCharacters: Character[] = [
    {
      id: 1,
      game_id: mockGameId,
      user_id: mockCurrentUserId,
      username: 'testuser',
      name: 'Hero',
      character_type: 'player_character',
      status: 'active',
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
    },
  ];

  const mockComment: Message = {
    id: 1,
    game_id: mockGameId,
    author_id: mockCurrentUserId,
    character_id: 1,
    content: 'This is a test comment in modal',
    message_type: 'comment',
    thread_depth: 0,
    author_username: 'testuser',
    character_name: 'Hero',
    reply_count: 0,
    is_edited: false,
    is_deleted: false,
    created_at: '2025-01-15T10:30:00Z',
    updated_at: '2025-01-15T10:30:00Z',
  };

  beforeEach(() => {
    // Setup MSW handlers for API calls made by components
    server.use(
      http.get('/api/v1/games/:gameId/details', () => {
        return HttpResponse.json({
          id: 1,
          title: 'Test Game',
          state: 'in_progress',
        });
      }),
      http.get('/api/v1/games/:gameId/participants', () => {
        return HttpResponse.json([]);
      })
    );
  });

  describe('Read-Only Mode', () => {
    it('should pass readOnly prop to ThreadedComment', async () => {
      renderWithProviders(
        <ThreadViewModal
          gameId={mockGameId}
          postId={mockPostId}
          comment={mockComment}
          characters={mockCharacters}
          controllableCharacters={mockCharacters}
          onClose={mockOnClose}
          onCreateReply={mockOnCreateReply}
          currentUserId={mockCurrentUserId}
          readOnly={true}
        />
      );

      // Comment content should be visible
      expect(screen.getByText('This is a test comment in modal')).toBeInTheDocument();

      // Edit/delete/reply buttons should NOT be visible (readOnly propagated to ThreadedComment)
      expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /reply/i })).not.toBeInTheDocument();
    });

    it('should allow interactions when readOnly=false', async () => {
      renderWithProviders(
        <ThreadViewModal
          gameId={mockGameId}
          postId={mockPostId}
          comment={mockComment}
          characters={mockCharacters}
          controllableCharacters={mockCharacters}
          onClose={mockOnClose}
          onCreateReply={mockOnCreateReply}
          currentUserId={mockCurrentUserId}
          readOnly={false}
        />
      );

      // Comment content should be visible
      expect(screen.getByText('This is a test comment in modal')).toBeInTheDocument();

      // Reply button SHOULD be visible (readOnly=false allows interactions)
      expect(screen.getByRole('button', { name: /reply/i })).toBeInTheDocument();
    });

    it('should propagate readOnly to parent chain comments', async () => {
      // Create a parent chain (3 levels deep)
      const parentComment1: Message = {
        ...mockComment,
        id: 10,
        content: 'Parent comment 1',
        thread_depth: 0,
      };

      const parentComment2: Message = {
        ...mockComment,
        id: 11,
        parent_id: 10,
        content: 'Parent comment 2',
        thread_depth: 1,
      };

      const targetComment: Message = {
        ...mockComment,
        id: 12,
        parent_id: 11,
        content: 'Target comment (deepest)',
        thread_depth: 2,
      };

      renderWithProviders(
        <ThreadViewModal
          gameId={mockGameId}
          postId={mockPostId}
          comment={targetComment}
          characters={mockCharacters}
          controllableCharacters={mockCharacters}
          onClose={mockOnClose}
          onCreateReply={mockOnCreateReply}
          currentUserId={mockCurrentUserId}
          parentChain={[parentComment1, parentComment2, targetComment]}
          hasFullThread={true}
          targetCommentId={12}
          readOnly={true}
        />
      );

      // All comments should be visible
      expect(screen.queryAllByText('Parent comment 1').length).toBeGreaterThanOrEqual(1);
      expect(screen.queryAllByText('Parent comment 2').length).toBeGreaterThanOrEqual(1);
      expect(screen.queryAllByText('Target comment (deepest)').length).toBeGreaterThanOrEqual(1);

      // No "Reply" action buttons should be visible (readOnly=true)
      // Note: This looks for the "Reply" button to create a new reply, not the collapse buttons
      const replyActionButtons = screen.queryAllByRole('button', { name: /^reply$/i });
      expect(replyActionButtons).toHaveLength(0);
    });

    it('should default readOnly to false when not provided', async () => {
      renderWithProviders(
        <ThreadViewModal
          gameId={mockGameId}
          postId={mockPostId}
          comment={mockComment}
          characters={mockCharacters}
          controllableCharacters={mockCharacters}
          onClose={mockOnClose}
          onCreateReply={mockOnCreateReply}
          currentUserId={mockCurrentUserId}
          // readOnly not provided - should default to false
        />
      );

      // Reply button should be visible (readOnly defaults to false)
      expect(screen.getByRole('button', { name: /reply/i })).toBeInTheDocument();
    });
  });

  describe('Modal Behavior', () => {
    it('should display Thread View heading', () => {
      renderWithProviders(
        <ThreadViewModal
          gameId={mockGameId}
          postId={mockPostId}
          comment={mockComment}
          characters={mockCharacters}
          controllableCharacters={mockCharacters}
          onClose={mockOnClose}
          onCreateReply={mockOnCreateReply}
          currentUserId={mockCurrentUserId}
        />
      );

      expect(screen.getByRole('heading', { name: /thread view/i })).toBeInTheDocument();
    });

    it('should have a close button', () => {
      renderWithProviders(
        <ThreadViewModal
          gameId={mockGameId}
          postId={mockPostId}
          comment={mockComment}
          characters={mockCharacters}
          controllableCharacters={mockCharacters}
          onClose={mockOnClose}
          onCreateReply={mockOnCreateReply}
          currentUserId={mockCurrentUserId}
        />
      );

      const closeButton = screen.getByRole('button', { name: /close/i });
      expect(closeButton).toBeInTheDocument();
    });
  });
});
