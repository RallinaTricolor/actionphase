import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CommentWithParentCard } from '../CommentWithParentCard';
import type { CommentWithParent } from '../../types/messages';
import { renderWithProviders } from '../../test-utils/render';

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
    renderWithProviders(<CommentWithParentCard comment={mockComment} gameId={1} />, { gameId: 1 });

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

    renderWithProviders(<CommentWithParentCard comment={editedComment} gameId={1} />, { gameId: 1 });

    expect(screen.getByText('Edited')).toBeInTheDocument();
  });

  it('does not show "Edited" badge when comment has not been edited', () => {
    renderWithProviders(<CommentWithParentCard comment={mockComment} gameId={1} />, { gameId: 1 });

    expect(screen.queryByText('Edited')).not.toBeInTheDocument();
  });

  it('shows deleted marker when comment is deleted', () => {
    const deletedComment = {
      ...mockComment,
      is_deleted: true,
      deleted_at: '2025-10-22T12:00:00Z',
    };

    renderWithProviders(<CommentWithParentCard comment={deletedComment} gameId={1} />, { gameId: 1 });

    expect(screen.getByText('[deleted]')).toBeInTheDocument();
    expect(screen.queryByText('This is a test comment')).not.toBeInTheDocument();
  });

  it('hides "View in thread" button when comment is deleted', () => {
    const deletedComment = {
      ...mockComment,
      is_deleted: true,
    };

    const mockNavigate = vi.fn();
    renderWithProviders(
      <CommentWithParentCard
        comment={deletedComment}
        gameId={1}
        onNavigateToComment={mockNavigate}
      />,
      { gameId: 1 }
    );

    expect(screen.queryByText(/view in thread/i)).not.toBeInTheDocument();
  });

  it('shows "View in thread" button when onNavigateToComment is provided', () => {
    const mockNavigate = vi.fn();
    renderWithProviders(
      <CommentWithParentCard
        comment={mockComment}
        gameId={1}
        onNavigateToComment={mockNavigate}
      />,
      { gameId: 1 }
    );

    expect(screen.getByText(/view in thread/i)).toBeInTheDocument();
  });

  it('hides "View in thread" button when onNavigateToComment is not provided', () => {
    renderWithProviders(<CommentWithParentCard comment={mockComment} gameId={1} />, { gameId: 1 });

    expect(screen.queryByText(/view in thread/i)).not.toBeInTheDocument();
  });

  it('calls onNavigateToComment when "View in thread" button is clicked', async () => {
    const user = userEvent.setup();
    const mockNavigate = vi.fn();

    renderWithProviders(
      <CommentWithParentCard
        comment={mockComment}
        gameId={1}
        onNavigateToComment={mockNavigate}
      />,
      { gameId: 1 }
    );

    const button = screen.getByText(/view in thread/i);
    await user.click(button);

    expect(mockNavigate).toHaveBeenCalledTimes(1);
  });

  it('does not show "view in thread" inside the parent preview (suppressed by hideViewInThread)', () => {
    const mockNavigate = vi.fn();

    renderWithProviders(
      <CommentWithParentCard
        comment={mockComment}
        gameId={1}
        onNavigateToParent={mockNavigate}
        onNavigateToComment={mockNavigate}
      />,
      { gameId: 1 }
    );

    // "View in thread" appears only once — at the card level, not inside the parent preview
    const links = screen.getAllByText(/view in thread/i);
    expect(links).toHaveLength(1);
  });

  it('formats timestamp as relative time', () => {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const recentComment = {
      ...mockComment,
      created_at: oneHourAgo,
    };

    renderWithProviders(<CommentWithParentCard comment={recentComment} gameId={1} />, { gameId: 1 });

    expect(screen.getByText(/1 hour ago/i)).toBeInTheDocument();
  });

  it('handles missing character name gracefully', () => {
    const commentWithoutCharacter = {
      ...mockComment,
      character_name: null,
    };

    renderWithProviders(<CommentWithParentCard comment={commentWithoutCharacter} gameId={1} />, { gameId: 1 });

    expect(screen.getByText('Unknown')).toBeInTheDocument();
  });

  it('applies hover shadow effect class', () => {
    const { container } = renderWithProviders(<CommentWithParentCard comment={mockComment} gameId={1} />, { gameId: 1 });

    const card = container.querySelector('.hover\\:shadow-md');
    expect(card).toBeInTheDocument();
  });

  it('renders "View in thread" as proper anchor tag with href', () => {
    const mockNavigate = vi.fn();
    renderWithProviders(
      <CommentWithParentCard
        comment={mockComment}
        gameId={2}
        onNavigateToComment={mockNavigate}
      />,
      { gameId: 2 }
    );

    const link = screen.getByText(/view in thread/i);
    expect(link.tagName).toBe('A');
    expect(link).toHaveAttribute('href', '/games/2?tab=common-room&comment=1');
  });
});
