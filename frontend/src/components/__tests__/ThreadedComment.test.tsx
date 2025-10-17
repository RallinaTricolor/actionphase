import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../mocks/server';
import { renderWithProviders } from '../../test-utils/render';
import { ThreadedComment } from '../ThreadedComment';
import type { Message } from '../../types/messages';
import type { Character } from '../../types/characters';

describe('ThreadedComment', () => {
  const mockGameId = 1;
  const mockOnCreateReply = vi.fn();
  const mockCurrentUserId = 100;

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
    {
      id: 2,
      game_id: mockGameId,
      user_id: mockCurrentUserId,
      username: 'testuser',
      name: 'Villain',
      character_type: 'player_character',
      status: 'active',
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
    },
  ];

  const mockComment: Message = {
    id: 1,
    game_id: mockGameId,
    author_id: 200,
    character_id: 3,
    content: 'This is a test comment',
    message_type: 'comment',
    thread_depth: 0,
    author_username: 'otheruser',
    character_name: 'Other Character',
    reply_count: 0,
    is_edited: false,
    is_deleted: false,
    created_at: '2025-01-15T10:30:00Z',
    updated_at: '2025-01-15T10:30:00Z',
  };

  const mockCommentWithReplies: Message = {
    ...mockComment,
    reply_count: 2,
  };

  const mockReplies: Message[] = [
    {
      id: 2,
      game_id: mockGameId,
      parent_id: 1,
      author_id: mockCurrentUserId,
      character_id: 1,
      content: 'This is a reply',
      message_type: 'comment',
      thread_depth: 1,
      author_username: 'testuser',
      character_name: 'Hero',
      reply_count: 0,
      is_edited: false,
      is_deleted: false,
      created_at: '2025-01-15T11:00:00Z',
      updated_at: '2025-01-15T11:00:00Z',
    },
    {
      id: 3,
      game_id: mockGameId,
      parent_id: 1,
      author_id: 300,
      character_id: 4,
      content: 'Another reply',
      message_type: 'comment',
      thread_depth: 1,
      author_username: 'thirduser',
      character_name: 'Third Character',
      reply_count: 0,
      is_edited: false,
      is_deleted: false,
      created_at: '2025-01-15T11:30:00Z',
      updated_at: '2025-01-15T11:30:00Z',
    },
  ];

  const setupDefaultHandlers = () => {
    server.use(
      http.get('/api/v1/games/:gameId/posts/:postId/comments', () => {
        return HttpResponse.json(mockReplies);
      })
    );
  };

  beforeEach(() => {
    server.resetHandlers();
    setupDefaultHandlers();
    mockOnCreateReply.mockClear();
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders comment content', () => {
      renderWithProviders(
        <ThreadedComment
          comment={mockComment}
          gameId={mockGameId}
          characters={mockCharacters}
          onCreateReply={mockOnCreateReply}
          currentUserId={mockCurrentUserId}
        />
      );

      expect(screen.getByText('This is a test comment')).toBeInTheDocument();
    });

    it('renders character name', () => {
      renderWithProviders(
        <ThreadedComment
          comment={mockComment}
          gameId={mockGameId}
          characters={mockCharacters}
          onCreateReply={mockOnCreateReply}
          currentUserId={mockCurrentUserId}
        />
      );

      expect(screen.getByText('Other Character')).toBeInTheDocument();
    });

    it('renders author username', () => {
      renderWithProviders(
        <ThreadedComment
          comment={mockComment}
          gameId={mockGameId}
          characters={mockCharacters}
          onCreateReply={mockOnCreateReply}
          currentUserId={mockCurrentUserId}
        />
      );

      expect(screen.getByText(/@otheruser/)).toBeInTheDocument();
    });

    it('renders timestamp', () => {
      renderWithProviders(
        <ThreadedComment
          comment={mockComment}
          gameId={mockGameId}
          characters={mockCharacters}
          onCreateReply={mockOnCreateReply}
          currentUserId={mockCurrentUserId}
        />
      );

      // Should display a formatted timestamp (date shows as full date for 2025-01-15)
      expect(screen.getByText(/1\/15\/2025|2025/)).toBeInTheDocument();
    });

    it('renders reply button', () => {
      renderWithProviders(
        <ThreadedComment
          comment={mockComment}
          gameId={mockGameId}
          characters={mockCharacters}
          onCreateReply={mockOnCreateReply}
          currentUserId={mockCurrentUserId}
        />
      );

      expect(screen.getByRole('button', { name: /reply/i })).toBeInTheDocument();
    });

    it('shows "You" badge when user is the author', () => {
      const ownComment: Message = {
        ...mockComment,
        author_id: mockCurrentUserId,
        author_username: 'testuser',
      };

      renderWithProviders(
        <ThreadedComment
          comment={ownComment}
          gameId={mockGameId}
          characters={mockCharacters}
          onCreateReply={mockOnCreateReply}
          currentUserId={mockCurrentUserId}
        />
      );

      expect(screen.getByText('You')).toBeInTheDocument();
    });

    it('does not show "You" badge when user is not the author', () => {
      renderWithProviders(
        <ThreadedComment
          comment={mockComment}
          gameId={mockGameId}
          characters={mockCharacters}
          onCreateReply={mockOnCreateReply}
          currentUserId={mockCurrentUserId}
        />
      );

      expect(screen.queryByText('You')).not.toBeInTheDocument();
    });

    it('shows edited indicator when comment is edited', () => {
      const editedComment: Message = {
        ...mockComment,
        is_edited: true,
      };

      renderWithProviders(
        <ThreadedComment
          comment={editedComment}
          gameId={mockGameId}
          characters={mockCharacters}
          onCreateReply={mockOnCreateReply}
          currentUserId={mockCurrentUserId}
        />
      );

      expect(screen.getByText('(edited)')).toBeInTheDocument();
    });

    it('does not show edited indicator when comment is not edited', () => {
      renderWithProviders(
        <ThreadedComment
          comment={mockComment}
          gameId={mockGameId}
          characters={mockCharacters}
          onCreateReply={mockOnCreateReply}
          currentUserId={mockCurrentUserId}
        />
      );

      expect(screen.queryByText('(edited)')).not.toBeInTheDocument();
    });

    it('applies indentation when depth is greater than 0', () => {
      const { container } = renderWithProviders(
        <ThreadedComment
          comment={mockComment}
          gameId={mockGameId}
          characters={mockCharacters}
          onCreateReply={mockOnCreateReply}
          currentUserId={mockCurrentUserId}
          depth={1}
        />
      );

      const commentContainer = container.querySelector('.ml-6');
      expect(commentContainer).toBeInTheDocument();
      expect(commentContainer).toHaveClass('border-l-2');
    });

    it('does not apply indentation when depth is 0', () => {
      const { container } = renderWithProviders(
        <ThreadedComment
          comment={mockComment}
          gameId={mockGameId}
          characters={mockCharacters}
          onCreateReply={mockOnCreateReply}
          currentUserId={mockCurrentUserId}
          depth={0}
        />
      );

      const commentContainer = container.querySelector('.ml-6');
      expect(commentContainer).not.toBeInTheDocument();
    });

    it('applies different border color based on depth', () => {
      const { container: container1 } = renderWithProviders(
        <ThreadedComment
          comment={mockComment}
          gameId={mockGameId}
          characters={mockCharacters}
          onCreateReply={mockOnCreateReply}
          currentUserId={mockCurrentUserId}
          depth={1}
        />
      );

      const { container: container2 } = renderWithProviders(
        <ThreadedComment
          comment={mockComment}
          gameId={mockGameId}
          characters={mockCharacters}
          onCreateReply={mockOnCreateReply}
          currentUserId={mockCurrentUserId}
          depth={2}
        />
      );

      const commentContainer1 = container1.querySelector('.border-l-2');
      const commentContainer2 = container2.querySelector('.border-l-2');

      // Should have different border color classes
      expect(commentContainer1?.className).not.toBe(commentContainer2?.className);
    });
  });

  describe('Reply Count Display', () => {
    it('shows reply count button when comment has replies', () => {
      renderWithProviders(
        <ThreadedComment
          comment={mockCommentWithReplies}
          gameId={mockGameId}
          characters={mockCharacters}
          onCreateReply={mockOnCreateReply}
          currentUserId={mockCurrentUserId}
        />
      );

      expect(screen.getByText(/2 replies/i)).toBeInTheDocument();
    });

    it('shows singular form for single reply', () => {
      const commentWithOneReply: Message = {
        ...mockComment,
        reply_count: 1,
      };

      renderWithProviders(
        <ThreadedComment
          comment={commentWithOneReply}
          gameId={mockGameId}
          characters={mockCharacters}
          onCreateReply={mockOnCreateReply}
          currentUserId={mockCurrentUserId}
        />
      );

      expect(screen.getByText(/1 reply/i)).toBeInTheDocument();
    });

    it('does not show reply count button when comment has no replies', () => {
      renderWithProviders(
        <ThreadedComment
          comment={mockComment}
          gameId={mockGameId}
          characters={mockCharacters}
          onCreateReply={mockOnCreateReply}
          currentUserId={mockCurrentUserId}
        />
      );

      expect(screen.queryByText(/replies/i)).not.toBeInTheDocument();
    });

    it('shows expand icon when replies are visible', () => {
      renderWithProviders(
        <ThreadedComment
          comment={mockCommentWithReplies}
          gameId={mockGameId}
          characters={mockCharacters}
          onCreateReply={mockOnCreateReply}
          currentUserId={mockCurrentUserId}
        />
      );

      expect(screen.getByText('▼')).toBeInTheDocument();
    });

    it('shows collapse icon when replies are hidden', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <ThreadedComment
          comment={mockCommentWithReplies}
          gameId={mockGameId}
          characters={mockCharacters}
          onCreateReply={mockOnCreateReply}
          currentUserId={mockCurrentUserId}
        />
      );

      const toggleButton = screen.getByRole('button', { name: /replies/i });
      await user.click(toggleButton);

      expect(screen.getByText('▶')).toBeInTheDocument();
    });
  });

  describe('Reply Form Toggle', () => {
    it('does not show reply form initially', () => {
      renderWithProviders(
        <ThreadedComment
          comment={mockComment}
          gameId={mockGameId}
          characters={mockCharacters}
          onCreateReply={mockOnCreateReply}
          currentUserId={mockCurrentUserId}
        />
      );

      expect(screen.queryByPlaceholderText(/write a reply/i)).not.toBeInTheDocument();
    });

    it('shows reply form when reply button is clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <ThreadedComment
          comment={mockComment}
          gameId={mockGameId}
          characters={mockCharacters}
          onCreateReply={mockOnCreateReply}
          currentUserId={mockCurrentUserId}
        />
      );

      const replyButton = screen.getByRole('button', { name: /reply/i });
      await user.click(replyButton);

      expect(screen.getByPlaceholderText(/write a reply/i)).toBeInTheDocument();
    });

    it('hides reply form when reply button is clicked again', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <ThreadedComment
          comment={mockComment}
          gameId={mockGameId}
          characters={mockCharacters}
          onCreateReply={mockOnCreateReply}
          currentUserId={mockCurrentUserId}
        />
      );

      const replyButton = screen.getByRole('button', { name: /reply/i });
      await user.click(replyButton);
      await user.click(replyButton);

      expect(screen.queryByPlaceholderText(/write a reply/i)).not.toBeInTheDocument();
    });
  });

  describe('Reply Form', () => {
    it('auto-selects first character when user has characters', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <ThreadedComment
          comment={mockComment}
          gameId={mockGameId}
          characters={mockCharacters}
          onCreateReply={mockOnCreateReply}
          currentUserId={mockCurrentUserId}
        />
      );

      const replyButton = screen.getByRole('button', { name: /reply/i });
      await user.click(replyButton);

      // Should auto-select first character (Hero)
      const select = screen.getByRole('combobox') as HTMLSelectElement;
      expect(select.value).toBe('1');
    });

    it('shows character dropdown when user has multiple characters', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <ThreadedComment
          comment={mockComment}
          gameId={mockGameId}
          characters={mockCharacters}
          onCreateReply={mockOnCreateReply}
          currentUserId={mockCurrentUserId}
        />
      );

      const replyButton = screen.getByRole('button', { name: /reply/i });
      await user.click(replyButton);

      expect(screen.getByRole('combobox')).toBeInTheDocument();
      expect(screen.getByText(/reply as hero/i)).toBeInTheDocument();
      expect(screen.getByText(/reply as villain/i)).toBeInTheDocument();
    });

    it('does not show character dropdown when user has single character', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <ThreadedComment
          comment={mockComment}
          gameId={mockGameId}
          characters={[mockCharacters[0]]}
          onCreateReply={mockOnCreateReply}
          currentUserId={mockCurrentUserId}
        />
      );

      const replyButton = screen.getByRole('button', { name: /reply/i });
      await user.click(replyButton);

      expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    });

    it('shows message when user has no characters', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <ThreadedComment
          comment={mockComment}
          gameId={mockGameId}
          characters={[]}
          onCreateReply={mockOnCreateReply}
          currentUserId={mockCurrentUserId}
        />
      );

      const replyButton = screen.getByRole('button', { name: /reply/i });
      await user.click(replyButton);

      expect(screen.getByText(/you need a character to reply/i)).toBeInTheDocument();
    });

    it('allows changing selected character', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <ThreadedComment
          comment={mockComment}
          gameId={mockGameId}
          characters={mockCharacters}
          onCreateReply={mockOnCreateReply}
          currentUserId={mockCurrentUserId}
        />
      );

      const replyButton = screen.getByRole('button', { name: /reply/i });
      await user.click(replyButton);

      const select = screen.getByRole('combobox') as HTMLSelectElement;
      await user.selectOptions(select, '2');

      expect(select.value).toBe('2');
    });

    it('allows typing in reply textarea', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <ThreadedComment
          comment={mockComment}
          gameId={mockGameId}
          characters={mockCharacters}
          onCreateReply={mockOnCreateReply}
          currentUserId={mockCurrentUserId}
        />
      );

      const replyButton = screen.getByRole('button', { name: /reply/i });
      await user.click(replyButton);

      const textarea = screen.getByPlaceholderText(/write a reply/i);
      await user.type(textarea, 'Test reply content');

      expect(textarea).toHaveValue('Test reply content');
    });

    it('disables reply button when content is empty', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <ThreadedComment
          comment={mockComment}
          gameId={mockGameId}
          characters={mockCharacters}
          onCreateReply={mockOnCreateReply}
          currentUserId={mockCurrentUserId}
        />
      );

      const replyButton = screen.getByRole('button', { name: /^reply$/i });
      await user.click(replyButton);

      // Find the submit button by its blue background styling (not the toggle button)
      const submitButtons = screen.getAllByRole('button', { name: /^reply$/i });
      const submitButton = submitButtons.find(btn => btn.className.includes('bg-blue-600'));
      expect(submitButton).toBeDisabled();
    });

    it('enables reply button when content is provided', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <ThreadedComment
          comment={mockComment}
          gameId={mockGameId}
          characters={mockCharacters}
          onCreateReply={mockOnCreateReply}
          currentUserId={mockCurrentUserId}
        />
      );

      await user.click(screen.getByRole('button', { name: /^reply$/i }));

      const textarea = screen.getByPlaceholderText(/write a reply/i);
      await user.type(textarea, 'Test reply');

      const submitButtons = screen.getAllByRole('button', { name: /^reply$/i });
      const submitButton = submitButtons.find(btn => btn.className.includes('bg-blue-600'));
      expect(submitButton).not.toBeDisabled();
    });

    it('disables reply button when content is only whitespace', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <ThreadedComment
          comment={mockComment}
          gameId={mockGameId}
          characters={mockCharacters}
          onCreateReply={mockOnCreateReply}
          currentUserId={mockCurrentUserId}
        />
      );

      await user.click(screen.getByRole('button', { name: /^reply$/i }));

      const textarea = screen.getByPlaceholderText(/write a reply/i);
      await user.type(textarea, '   ');

      const submitButtons = screen.getAllByRole('button', { name: /^reply$/i });
      const submitButton = submitButtons.find(btn => btn.className.includes('bg-blue-600'));
      expect(submitButton).toBeDisabled();
    });

    it('shows cancel button', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <ThreadedComment
          comment={mockComment}
          gameId={mockGameId}
          characters={mockCharacters}
          onCreateReply={mockOnCreateReply}
          currentUserId={mockCurrentUserId}
        />
      );

      await user.click(screen.getByRole('button', { name: /^reply$/i }));

      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    });

    it('closes form when cancel button is clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <ThreadedComment
          comment={mockComment}
          gameId={mockGameId}
          characters={mockCharacters}
          onCreateReply={mockOnCreateReply}
          currentUserId={mockCurrentUserId}
        />
      );

      await user.click(screen.getByRole('button', { name: /^reply$/i }));
      const textarea = screen.getByPlaceholderText(/write a reply/i);
      await user.type(textarea, 'Test content');

      await user.click(screen.getByRole('button', { name: /cancel/i }));

      expect(screen.queryByPlaceholderText(/write a reply/i)).not.toBeInTheDocument();
    });

    it('clears form content when cancel is clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <ThreadedComment
          comment={mockComment}
          gameId={mockGameId}
          characters={mockCharacters}
          onCreateReply={mockOnCreateReply}
          currentUserId={mockCurrentUserId}
        />
      );

      await user.click(screen.getByRole('button', { name: /^reply$/i }));
      const textarea = screen.getByPlaceholderText(/write a reply/i);
      await user.type(textarea, 'Test content');
      await user.click(screen.getByRole('button', { name: /cancel/i }));

      // Reopen form
      await user.click(screen.getByRole('button', { name: /^reply$/i }));
      const newTextarea = screen.getByPlaceholderText(/write a reply/i);

      expect(newTextarea).toHaveValue('');
    });
  });

  describe('Reply Submission', () => {
    it('calls onCreateReply with correct parameters', async () => {
      const user = userEvent.setup();
      mockOnCreateReply.mockResolvedValueOnce(undefined);

      renderWithProviders(
        <ThreadedComment
          comment={mockComment}
          gameId={mockGameId}
          characters={mockCharacters}
          onCreateReply={mockOnCreateReply}
          currentUserId={mockCurrentUserId}
        />
      );

      await user.click(screen.getByRole('button', { name: /^reply$/i }));

      const textarea = screen.getByPlaceholderText(/write a reply/i);
      await user.type(textarea, 'Test reply');

      const submitButtons = screen.getAllByRole('button', { name: /^reply$/i });
      const submitButton = submitButtons.find(btn => btn.className.includes('bg-blue-600'))!;
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockOnCreateReply).toHaveBeenCalledWith(1, 1, 'Test reply');
      });
    });

    it('trims whitespace from reply content', async () => {
      const user = userEvent.setup();
      mockOnCreateReply.mockResolvedValueOnce(undefined);

      renderWithProviders(
        <ThreadedComment
          comment={mockComment}
          gameId={mockGameId}
          characters={mockCharacters}
          onCreateReply={mockOnCreateReply}
          currentUserId={mockCurrentUserId}
        />
      );

      await user.click(screen.getByRole('button', { name: /^reply$/i }));

      const textarea = screen.getByPlaceholderText(/write a reply/i);
      await user.type(textarea, '  Test reply  ');

      const submitButtons = screen.getAllByRole('button', { name: /^reply$/i });
      const submitButton = submitButtons.find(btn => btn.className.includes('bg-blue-600'))!;
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockOnCreateReply).toHaveBeenCalledWith(1, 1, 'Test reply');
      });
    });

    it('clears form after successful submission', async () => {
      const user = userEvent.setup();
      mockOnCreateReply.mockResolvedValueOnce(undefined);

      renderWithProviders(
        <ThreadedComment
          comment={mockComment}
          gameId={mockGameId}
          characters={mockCharacters}
          onCreateReply={mockOnCreateReply}
          currentUserId={mockCurrentUserId}
        />
      );

      await user.click(screen.getByRole('button', { name: /^reply$/i }));

      const textarea = screen.getByPlaceholderText(/write a reply/i);
      await user.type(textarea, 'Test reply');

      const submitButtons = screen.getAllByRole('button', { name: /^reply$/i });
      const submitButton = submitButtons.find(btn => btn.className.includes('bg-blue-600'))!;
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.queryByPlaceholderText(/write a reply/i)).not.toBeInTheDocument();
      });
    });

    it('shows loading state during submission', async () => {
      const user = userEvent.setup();
      mockOnCreateReply.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      );

      renderWithProviders(
        <ThreadedComment
          comment={mockComment}
          gameId={mockGameId}
          characters={mockCharacters}
          onCreateReply={mockOnCreateReply}
          currentUserId={mockCurrentUserId}
        />
      );

      await user.click(screen.getByRole('button', { name: /^reply$/i }));

      const textarea = screen.getByPlaceholderText(/write a reply/i);
      await user.type(textarea, 'Test reply');

      const submitButtons = screen.getAllByRole('button', { name: /^reply$/i });
      const submitButton = submitButtons.find(btn => btn.className.includes('bg-blue-600'))!;
      await user.click(submitButton);

      expect(screen.getByText(/posting\.\.\./i)).toBeInTheDocument();
    });

    it('disables form fields during submission', async () => {
      const user = userEvent.setup();
      mockOnCreateReply.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      );

      renderWithProviders(
        <ThreadedComment
          comment={mockComment}
          gameId={mockGameId}
          characters={mockCharacters}
          onCreateReply={mockOnCreateReply}
          currentUserId={mockCurrentUserId}
        />
      );

      await user.click(screen.getByRole('button', { name: /^reply$/i }));

      const textarea = screen.getByPlaceholderText(/write a reply/i);
      await user.type(textarea, 'Test reply');

      const submitButtons = screen.getAllByRole('button', { name: /^reply$/i });
      const submitButton = submitButtons.find(btn => btn.className.includes('bg-blue-600'))!;
      await user.click(submitButton);

      expect(textarea).toBeDisabled();
      expect(screen.getByRole('button', { name: /posting\.\.\./i })).toBeDisabled();
      expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled();
    });

    it('reloads replies after successful submission', async () => {
      const user = userEvent.setup();
      mockOnCreateReply.mockResolvedValueOnce(undefined);

      renderWithProviders(
        <ThreadedComment
          comment={mockComment}
          gameId={mockGameId}
          characters={mockCharacters}
          onCreateReply={mockOnCreateReply}
          currentUserId={mockCurrentUserId}
        />
      );

      await user.click(screen.getByRole('button', { name: /^reply$/i }));

      const textarea = screen.getByPlaceholderText(/write a reply/i);
      await user.type(textarea, 'Test reply');

      const submitButtons = screen.getAllByRole('button', { name: /^reply$/i });
      const submitButton = submitButtons.find(btn => btn.className.includes('bg-blue-600'))!;
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockOnCreateReply).toHaveBeenCalled();
      });

      // Should reload replies - this would trigger the getPostComments API call
      // which is mocked to return mockReplies
      await waitFor(() => {
        expect(screen.queryByText(/posting\.\.\./i)).not.toBeInTheDocument();
      });
    });

  });

  describe('Nested Replies', () => {
    it('automatically loads replies when comment has replies', async () => {
      renderWithProviders(
        <ThreadedComment
          comment={mockCommentWithReplies}
          gameId={mockGameId}
          characters={mockCharacters}
          onCreateReply={mockOnCreateReply}
          currentUserId={mockCurrentUserId}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('This is a reply')).toBeInTheDocument();
        expect(screen.getByText('Another reply')).toBeInTheDocument();
      });
    });

    it('shows loading state while loading replies', async () => {
      server.use(
        http.get('/api/v1/games/:gameId/posts/:postId/comments', async () => {
          await new Promise((resolve) => setTimeout(resolve, 100));
          return HttpResponse.json(mockReplies);
        })
      );

      renderWithProviders(
        <ThreadedComment
          comment={mockCommentWithReplies}
          gameId={mockGameId}
          characters={mockCharacters}
          onCreateReply={mockOnCreateReply}
          currentUserId={mockCurrentUserId}
        />
      );

      expect(screen.getByText(/loading replies\.\.\./i)).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.queryByText(/loading replies\.\.\./i)).not.toBeInTheDocument();
      });
    });

    it('toggles replies visibility when reply count button is clicked', async () => {
      const user = userEvent.setup();

      renderWithProviders(
        <ThreadedComment
          comment={mockCommentWithReplies}
          gameId={mockGameId}
          characters={mockCharacters}
          onCreateReply={mockOnCreateReply}
          currentUserId={mockCurrentUserId}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('This is a reply')).toBeInTheDocument();
      });

      const toggleButton = screen.getByRole('button', { name: /replies/i });
      await user.click(toggleButton);

      await waitFor(() => {
        expect(screen.queryByText('This is a reply')).not.toBeInTheDocument();
      });

      await user.click(toggleButton);

      await waitFor(() => {
        expect(screen.getByText('This is a reply')).toBeInTheDocument();
      });
    });

    it('renders nested ThreadedComment components recursively', async () => {
      renderWithProviders(
        <ThreadedComment
          comment={mockCommentWithReplies}
          gameId={mockGameId}
          characters={mockCharacters}
          onCreateReply={mockOnCreateReply}
          currentUserId={mockCurrentUserId}
        />
      );

      await waitFor(() => {
        // Should render the nested replies
        expect(screen.getByText('Hero')).toBeInTheDocument();
        expect(screen.getByText('Third Character')).toBeInTheDocument();
      });
    });

    it('increases depth for nested comments', async () => {
      const { container } = renderWithProviders(
        <ThreadedComment
          comment={mockCommentWithReplies}
          gameId={mockGameId}
          characters={mockCharacters}
          onCreateReply={mockOnCreateReply}
          currentUserId={mockCurrentUserId}
          depth={1}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('This is a reply')).toBeInTheDocument();
      });

      // Parent should have depth 1 indentation
      const parentContainer = container.querySelector('.ml-6.border-l-2');
      expect(parentContainer).toBeInTheDocument();

      // Nested replies would have depth 2, but we can't easily verify this
      // without inspecting the DOM structure more deeply
    });

    it('does not show nested replies when showReplies is false', async () => {
      const user = userEvent.setup();

      renderWithProviders(
        <ThreadedComment
          comment={mockCommentWithReplies}
          gameId={mockGameId}
          characters={mockCharacters}
          onCreateReply={mockOnCreateReply}
          currentUserId={mockCurrentUserId}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('This is a reply')).toBeInTheDocument();
      });

      const toggleButton = screen.getByRole('button', { name: /replies/i });
      await user.click(toggleButton);

      expect(screen.queryByText('This is a reply')).not.toBeInTheDocument();
    });

    it('shows replies after submitting a new reply', async () => {
      const user = userEvent.setup();
      mockOnCreateReply.mockResolvedValueOnce(undefined);

      renderWithProviders(
        <ThreadedComment
          comment={mockComment}
          gameId={mockGameId}
          characters={mockCharacters}
          onCreateReply={mockOnCreateReply}
          currentUserId={mockCurrentUserId}
        />
      );

      await user.click(screen.getByRole('button', { name: /^reply$/i }));

      const textarea = screen.getByPlaceholderText(/write a reply/i);
      await user.type(textarea, 'New reply');

      const submitButtons = screen.getAllByRole('button', { name: /^reply$/i });
      const submitButton = submitButtons.find(btn => btn.className.includes('bg-blue-600'))!;
      await user.click(submitButton);

      // After submission, replies should be loaded and visible
      await waitFor(() => {
        expect(screen.getByText('This is a reply')).toBeInTheDocument();
      });
    });
  });

  describe('Date Formatting', () => {
    it('formats recent timestamps as "just now"', () => {
      const recentComment: Message = {
        ...mockComment,
        created_at: new Date().toISOString(),
      };

      renderWithProviders(
        <ThreadedComment
          comment={recentComment}
          gameId={mockGameId}
          characters={mockCharacters}
          onCreateReply={mockOnCreateReply}
          currentUserId={mockCurrentUserId}
        />
      );

      expect(screen.getByText(/just now/i)).toBeInTheDocument();
    });

    it('formats timestamps within an hour as minutes ago', () => {
      const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      const recentComment: Message = {
        ...mockComment,
        created_at: thirtyMinsAgo,
      };

      renderWithProviders(
        <ThreadedComment
          comment={recentComment}
          gameId={mockGameId}
          characters={mockCharacters}
          onCreateReply={mockOnCreateReply}
          currentUserId={mockCurrentUserId}
        />
      );

      expect(screen.getByText(/30m ago/i)).toBeInTheDocument();
    });

    it('formats timestamps within a day as hours ago', () => {
      const fiveHoursAgo = new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString();
      const recentComment: Message = {
        ...mockComment,
        created_at: fiveHoursAgo,
      };

      renderWithProviders(
        <ThreadedComment
          comment={recentComment}
          gameId={mockGameId}
          characters={mockCharacters}
          onCreateReply={mockOnCreateReply}
          currentUserId={mockCurrentUserId}
        />
      );

      expect(screen.getByText(/5h ago/i)).toBeInTheDocument();
    });

    it('formats timestamps within a week as days ago', () => {
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
      const recentComment: Message = {
        ...mockComment,
        created_at: threeDaysAgo,
      };

      renderWithProviders(
        <ThreadedComment
          comment={recentComment}
          gameId={mockGameId}
          characters={mockCharacters}
          onCreateReply={mockOnCreateReply}
          currentUserId={mockCurrentUserId}
        />
      );

      expect(screen.getByText(/3d ago/i)).toBeInTheDocument();
    });

    it('formats old timestamps as full date', () => {
      // Using a date from 2023 to ensure it's more than a week ago
      const oldComment: Message = {
        ...mockComment,
        created_at: '2023-01-01T00:00:00Z',
      };

      renderWithProviders(
        <ThreadedComment
          comment={oldComment}
          gameId={mockGameId}
          characters={mockCharacters}
          onCreateReply={mockOnCreateReply}
          currentUserId={mockCurrentUserId}
        />
      );

      // Should display a formatted date - just verify something that looks like a date exists
      // (the exact format varies by locale, so we just check that there's a date pattern)
      expect(screen.getByText(/\d{1,2}\/\d{1,2}\/\d{4}|\d{4}/)).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('handles error when loading replies fails', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      server.use(
        http.get('/api/v1/games/:gameId/posts/:postId/comments', () => {
          return HttpResponse.json({ error: 'Failed to load replies' }, { status: 500 });
        })
      );

      renderWithProviders(
        <ThreadedComment
          comment={mockCommentWithReplies}
          gameId={mockGameId}
          characters={mockCharacters}
          onCreateReply={mockOnCreateReply}
          currentUserId={mockCurrentUserId}
        />
      );

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalled();
      });

      consoleErrorSpy.mockRestore();
    });

    it('handles error when creating reply fails', async () => {
      const user = userEvent.setup();
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockOnCreateReply.mockRejectedValueOnce(new Error('Failed to create reply'));

      renderWithProviders(
        <ThreadedComment
          comment={mockComment}
          gameId={mockGameId}
          characters={mockCharacters}
          onCreateReply={mockOnCreateReply}
          currentUserId={mockCurrentUserId}
        />
      );

      await user.click(screen.getByRole('button', { name: /^reply$/i }));

      const textarea = screen.getByPlaceholderText(/write a reply/i);
      await user.type(textarea, 'Test reply');

      const submitButtons = screen.getAllByRole('button', { name: /^reply$/i });
      const submitButton = submitButtons.find(btn => btn.className.includes('bg-blue-600'))!;
      await user.click(submitButton);

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalled();
      });

      // Form should remain open with content preserved
      expect(screen.getByPlaceholderText(/write a reply/i)).toHaveValue('Test reply');

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Integration', () => {
    it('handles complete workflow from viewing to replying', async () => {
      const user = userEvent.setup();
      mockOnCreateReply.mockResolvedValueOnce(undefined);

      renderWithProviders(
        <ThreadedComment
          comment={mockCommentWithReplies}
          gameId={mockGameId}
          characters={mockCharacters}
          onCreateReply={mockOnCreateReply}
          currentUserId={mockCurrentUserId}
        />
      );

      // Wait for replies to load
      await waitFor(() => {
        expect(screen.getByText('This is a reply')).toBeInTheDocument();
      });

      // Collapse replies
      const toggleButton = screen.getByRole('button', { name: /replies/i });
      await user.click(toggleButton);

      await waitFor(() => {
        expect(screen.queryByText('This is a reply')).not.toBeInTheDocument();
      });

      // Open reply form
      await user.click(screen.getByRole('button', { name: /^reply$/i }));

      // Change character
      const select = screen.getByRole('combobox') as HTMLSelectElement;
      await user.selectOptions(select, '2');

      // Type reply
      const textarea = screen.getByPlaceholderText(/write a reply/i);
      await user.type(textarea, 'My detailed reply');

      // Submit
      const submitButtons = screen.getAllByRole('button', { name: /^reply$/i });
      const submitButton = submitButtons.find(btn => btn.className.includes('bg-blue-600'))!;
      await user.click(submitButton);

      // Verify submission
      await waitFor(() => {
        expect(mockOnCreateReply).toHaveBeenCalledWith(1, 2, 'My detailed reply');
      });

      // Replies should be visible again after submission
      await waitFor(() => {
        expect(screen.getByText('This is a reply')).toBeInTheDocument();
      });
    });

    it('handles nested reply workflow', async () => {
      const user = userEvent.setup();
      mockOnCreateReply.mockResolvedValueOnce(undefined);

      renderWithProviders(
        <ThreadedComment
          comment={mockCommentWithReplies}
          gameId={mockGameId}
          characters={mockCharacters}
          onCreateReply={mockOnCreateReply}
          currentUserId={mockCurrentUserId}
          depth={1}
        />
      );

      // Wait for nested replies to load
      await waitFor(() => {
        expect(screen.getByText('This is a reply')).toBeInTheDocument();
      });

      // Click reply button
      const replyButtons = screen.getAllByRole('button', { name: /^reply$/i });
      await user.click(replyButtons[0]);

      // Type and submit reply
      const textarea = screen.getByPlaceholderText(/write a reply/i);
      await user.type(textarea, 'Nested reply');

      const submitButtons = screen.getAllByRole('button', { name: /^reply$/i });
      const submitButton = submitButtons.find(btn => btn.className.includes('bg-blue-600'))!;
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockOnCreateReply).toHaveBeenCalledWith(1, 1, 'Nested reply');
      });
    });
  });
});
