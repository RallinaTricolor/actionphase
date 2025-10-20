import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThreadedComment } from '../ThreadedComment';
import type { Message } from '../../types/messages';

const mockComment: Message = {
  id: 1,
  game_id: 1,
  phase_id: 1,
  author_id: 100,
  author_username: 'testuser',
  character_id: 10,
  character_name: 'Test Character',
  character_avatar_url: null,
  content: 'Test comment content',
  message_type: 'comment',
  parent_id: null,
  visibility: 'all',
  created_at: '2025-01-15T12:00:00Z',
  updated_at: '2025-01-15T12:00:00Z',
  is_deleted: false,
  is_edited: false,
  reply_count: 3,
  mentioned_character_ids: [],
};

describe('ThreadedComment - Depth Limiting', () => {
  it('should show reply button when under max depth', () => {
    render(
      <ThreadedComment
        comment={mockComment}
        gameId={1}
        characters={[]}
        controllableCharacters={[{ id: 10, name: 'Test Character', game_id: 1, owner_id: 100, avatar_url: null, character_sheet: null, is_gm: false, created_at: '', updated_at: '' }]}
        onCreateReply={vi.fn()}
        depth={0}
        maxDepth={5}
      />
    );

    expect(screen.getByText('Reply')).toBeInTheDocument();
  });

  it('should hide reply button at max depth', () => {
    render(
      <ThreadedComment
        comment={mockComment}
        gameId={1}
        characters={[]}
        controllableCharacters={[{ id: 10, name: 'Test Character', game_id: 1, owner_id: 100, avatar_url: null, character_sheet: null, is_gm: false, created_at: '', updated_at: '' }]}
        onCreateReply={vi.fn()}
        depth={5}
        maxDepth={5}
      />
    );

    expect(screen.queryByText('Reply')).not.toBeInTheDocument();
  });

  it('should show "Continue thread" link at max depth with replies', () => {
    const commentWithReplies: Message = {
      ...mockComment,
      reply_count: 3,
    };

    render(
      <ThreadedComment
        comment={commentWithReplies}
        gameId={1}
        characters={[]}
        controllableCharacters={[]}
        onCreateReply={vi.fn()}
        depth={5}
        maxDepth={5}
      />
    );

    const continueLink = screen.getByText(/Continue this thread/);
    expect(continueLink).toBeInTheDocument();
    expect(screen.getByText(/3 replies/)).toBeInTheDocument();
  });

  it('should not show "Continue thread" link at max depth without replies', () => {
    const commentWithoutReplies: Message = {
      ...mockComment,
      reply_count: 0,
    };

    render(
      <ThreadedComment
        comment={commentWithoutReplies}
        gameId={1}
        characters={[]}
        controllableCharacters={[]}
        onCreateReply={vi.fn()}
        depth={5}
        maxDepth={5}
      />
    );

    expect(screen.queryByText(/Continue this thread/)).not.toBeInTheDocument();
  });

  it('should link to correct thread view URL', () => {
    const commentWithReplies: Message = {
      ...mockComment,
      id: 123,
      reply_count: 2,
    };

    render(
      <ThreadedComment
        comment={commentWithReplies}
        gameId={42}
        characters={[]}
        controllableCharacters={[]}
        onCreateReply={vi.fn()}
        depth={5}
        maxDepth={5}
      />
    );

    const link = screen.getByText(/Continue this thread/).closest('a');
    expect(link).toHaveAttribute('href', '/games/42/common-room/thread/123');
  });

  it('should hide replies collapse button at max depth', () => {
    const commentWithReplies: Message = {
      ...mockComment,
      reply_count: 5,
    };

    render(
      <ThreadedComment
        comment={commentWithReplies}
        gameId={1}
        characters={[]}
        controllableCharacters={[]}
        onCreateReply={vi.fn()}
        depth={5}
        maxDepth={5}
      />
    );

    // The collapse/expand button should not be present at max depth
    expect(screen.queryByText('▼')).not.toBeInTheDocument();
    expect(screen.queryByText('▶')).not.toBeInTheDocument();
  });

  it('should use default maxDepth of 5', () => {
    render(
      <ThreadedComment
        comment={mockComment}
        gameId={1}
        characters={[]}
        controllableCharacters={[{ id: 10, name: 'Test Character', game_id: 1, owner_id: 100, avatar_url: null, character_sheet: null, is_gm: false, created_at: '', updated_at: '' }]}
        onCreateReply={vi.fn()}
        depth={4}
        // maxDepth not specified - should default to 5
      />
    );

    // At depth 4 with default maxDepth 5, reply button should show
    expect(screen.getByText('Reply')).toBeInTheDocument();
  });

  it('should respect custom maxDepth prop', () => {
    render(
      <ThreadedComment
        comment={mockComment}
        gameId={1}
        characters={[]}
        controllableCharacters={[{ id: 10, name: 'Test Character', game_id: 1, owner_id: 100, avatar_url: null, character_sheet: null, is_gm: false, created_at: '', updated_at: '' }]}
        onCreateReply={vi.fn()}
        depth={3}
        maxDepth={3}
      />
    );

    // At depth 3 with maxDepth 3, reply button should NOT show
    expect(screen.queryByText('Reply')).not.toBeInTheDocument();
  });

  it('should display correct reply count in continue thread link', () => {
    const commentWithManyReplies: Message = {
      ...mockComment,
      reply_count: 15,
    };

    render(
      <ThreadedComment
        comment={commentWithManyReplies}
        gameId={1}
        characters={[]}
        controllableCharacters={[]}
        onCreateReply={vi.fn()}
        depth={5}
        maxDepth={5}
      />
    );

    expect(screen.getByText(/15 replies/)).toBeInTheDocument();
  });

  it('should show singular "reply" for single reply', () => {
    const commentWithOneReply: Message = {
      ...mockComment,
      reply_count: 1,
    };

    render(
      <ThreadedComment
        comment={commentWithOneReply}
        gameId={1}
        characters={[]}
        controllableCharacters={[]}
        onCreateReply={vi.fn()}
        depth={5}
        maxDepth={5}
      />
    );

    expect(screen.getByText(/1 reply/)).toBeInTheDocument();
    expect(screen.queryByText(/1 replies/)).not.toBeInTheDocument();
  });
});
