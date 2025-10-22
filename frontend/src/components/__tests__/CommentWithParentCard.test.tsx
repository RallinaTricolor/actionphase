import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CommentWithParentCard } from '../CommentWithParentCard';
import type { CommentWithParent } from '../../types/messages';

// Mock the MarkdownPreview component
vi.mock('../MarkdownPreview', () => ({
  MarkdownPreview: ({ content }: { content: string }) => <div>{content}</div>,
}));

describe('CommentWithParentCard', () => {
  const mockComment: CommentWithParent = {
    id: 1,
    game_id: 1,
    parent_id: 100,
    author_id: 10,
    character_id: 20,
    content: 'This is a test comment',
    created_at: '2025-10-22T10:00:00Z',
    updated_at: '2025-10-22T10:00:00Z',
    edited_at: null,
    edit_count: 0,
    deleted_at: null,
    is_deleted: false,
    author_username: 'testuser',
    character_name: 'Test Character',
    parent_content: 'Parent post content',
    parent_created_at: '2025-10-22T09:00:00Z',
    parent_deleted_at: null,
    parent_is_deleted: false,
    parent_message_type: 'post',
    parent_author_username: 'parentuser',
    parent_character_name: 'Parent Character',
  };

  it('renders comment with parent preview', () => {
    render(<CommentWithParentCard comment={mockComment} />);

    // Check comment content
    expect(screen.getByText('This is a test comment')).toBeInTheDocument();
    expect(screen.getByText('Test Character')).toBeInTheDocument();
    expect(screen.getByText(/testuser/i)).toBeInTheDocument();

    // Check parent preview
    expect(screen.getByText('Parent post content')).toBeInTheDocument();
  });

  it('shows "Edited" badge when comment has been edited', () => {
    const editedComment = {
      ...mockComment,
      edit_count: 2,
      edited_at: '2025-10-22T11:00:00Z',
    };

    render(<CommentWithParentCard comment={editedComment} />);

    expect(screen.getByText('Edited')).toBeInTheDocument();
  });

  it('does not show "Edited" badge when comment has not been edited', () => {
    render(<CommentWithParentCard comment={mockComment} />);

    expect(screen.queryByText('Edited')).not.toBeInTheDocument();
  });

  it('shows deleted marker when comment is deleted', () => {
    const deletedComment = {
      ...mockComment,
      is_deleted: true,
      deleted_at: '2025-10-22T12:00:00Z',
    };

    render(<CommentWithParentCard comment={deletedComment} />);

    expect(screen.getByText('[deleted]')).toBeInTheDocument();
    expect(screen.queryByText('This is a test comment')).not.toBeInTheDocument();
  });

  it('hides "View in thread" button when comment is deleted', () => {
    const deletedComment = {
      ...mockComment,
      is_deleted: true,
    };

    const mockNavigate = vi.fn();
    render(
      <CommentWithParentCard
        comment={deletedComment}
        onNavigateToComment={mockNavigate}
      />
    );

    expect(screen.queryByText(/view in thread/i)).not.toBeInTheDocument();
  });

  it('shows "View in thread" button when onNavigateToComment is provided', () => {
    const mockNavigate = vi.fn();
    render(
      <CommentWithParentCard
        comment={mockComment}
        onNavigateToComment={mockNavigate}
      />
    );

    expect(screen.getByText(/view in thread/i)).toBeInTheDocument();
  });

  it('hides "View in thread" button when onNavigateToComment is not provided', () => {
    render(<CommentWithParentCard comment={mockComment} />);

    expect(screen.queryByText(/view in thread/i)).not.toBeInTheDocument();
  });

  it('calls onNavigateToComment when "View in thread" button is clicked', async () => {
    const user = userEvent.setup();
    const mockNavigate = vi.fn();

    render(
      <CommentWithParentCard
        comment={mockComment}
        onNavigateToComment={mockNavigate}
      />
    );

    const button = screen.getByText(/view in thread/i);
    await user.click(button);

    expect(mockNavigate).toHaveBeenCalledTimes(1);
  });

  it('passes onNavigateToParent to ParentCommentPreview', async () => {
    const user = userEvent.setup();
    const mockNavigate = vi.fn();

    render(
      <CommentWithParentCard
        comment={mockComment}
        onNavigateToParent={mockNavigate}
      />
    );

    const parentButton = screen.getByText(/view in thread/i);
    await user.click(parentButton);

    expect(mockNavigate).toHaveBeenCalledTimes(1);
  });

  it('formats timestamp as relative time', () => {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const recentComment = {
      ...mockComment,
      created_at: oneHourAgo,
    };

    render(<CommentWithParentCard comment={recentComment} />);

    expect(screen.getByText(/1 hour ago/i)).toBeInTheDocument();
  });

  it('handles missing character name gracefully', () => {
    const commentWithoutCharacter = {
      ...mockComment,
      character_name: null,
    };

    render(<CommentWithParentCard comment={commentWithoutCharacter} />);

    expect(screen.getByText('Unknown')).toBeInTheDocument();
  });

  it('applies hover shadow effect class', () => {
    const { container } = render(<CommentWithParentCard comment={mockComment} />);

    const card = container.querySelector('.hover\\:shadow-md');
    expect(card).toBeInTheDocument();
  });
});
