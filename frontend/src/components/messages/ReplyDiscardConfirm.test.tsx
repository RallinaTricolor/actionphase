import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test-utils/render';
import { PostCard } from './PostCard';
import { ThreadedComment } from './ThreadedComment';
import { CommentWithParentCard } from './CommentWithParentCard';
import type { CommentWithParent } from '@/types/messages';
import { makeCharacter, makeMessage } from '@/test-utils/factories';
import { postCachingService } from '@/services/PostCachingService';
import { useGameContext } from '@/contexts/GameContext';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Cancel on a reply form discards whatever is typed, and it sits directly beside
 * the submit button — a misclick used to silently eat the draft. These tests
 * cover the confirmation that now guards it, on both reply surfaces: the
 * top-level comment form on a common room post and the nested reply form on a
 * threaded comment.
 *
 * ConfirmModal is deliberately NOT mocked here — the point of these tests is
 * that a real dialog appears and that dismissing it preserves the draft.
 * CommentEditor is stood in for by a plain textarea so the tests can type; the
 * real editor is exercised by CommentEditor.test.tsx.
 */
vi.mock('./CommentEditor', () => ({
  CommentEditor: ({
    value,
    onChange,
    placeholder,
  }: {
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
  }) => (
    <textarea
      data-testid="comment-editor"
      aria-label={placeholder ?? 'editor'}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

vi.mock('@/hooks/useScreenshotMode', () => ({
  useScreenshotMode: () => ({ screenshotModeEnabled: false, toggleScreenshotMode: vi.fn() }),
}));

vi.mock('@/hooks/useAdminMode', () => ({
  useAdminMode: () => ({ adminModeEnabled: false, isAdmin: false }),
}));

vi.mock('@/hooks/useGamePermissions', () => ({
  useGamePermissions: () => ({ isGM: false, hasGMPowers: false, isPlayer: true }),
}));

vi.mock('@/hooks/useCommentMutations', () => ({
  useUpdateComment: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteComment: () => ({ mutate: vi.fn(), isPending: false }),
}));

// CommentWithParentCard reads its characters and viewer from context rather
// than props, so the New Comments cases drive those directly.
vi.mock('@/contexts/GameContext', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/contexts/GameContext')>()),
  useGameContext: vi.fn(),
}));

vi.mock('@/contexts/AuthContext', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/contexts/AuthContext')>()),
  useAuth: vi.fn(),
}));

// PostCard pulls useUpdatePost from the @/hooks barrel, which re-exports the
// mocked hook modules above; mocking those leaves the barrel's copy undefined,
// so the barrel needs its own stand-in.
vi.mock('@/hooks', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/hooks')>()),
  useUpdatePost: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }),
}));

const characters = [makeCharacter({ id: 1, game_id: 1, name: 'Test Character', user_id: 100 })];

const gameContextValue = {
  game: null,
  gameId: 1,
  participants: [],
  isLoadingGame: false,
  isLoadingParticipants: false,
  isLoadingCharacters: false,
  isLoadingAllCharacters: false,
  userRole: 'player' as const,
  isGM: false,
  isParticipant: true,
  isInGame: true,
  canEditGame: false,
  userCharacters: [
    { id: 99, name: 'My Character', username: 'myuser', character_type: 'player' as const, avatar_url: null },
  ],
  allGameCharacters: characters,
  currentPhaseId: null,
  isUserCharacter: () => false,
  refetchGameData: vi.fn(),
  refetchAllGameCharacters: vi.fn(),
};

describe('discard confirmation on reply Cancel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.mocked(useGameContext).mockReturnValue(gameContextValue as never);
    vi.mocked(useAuth).mockReturnValue({ currentUser: null } as never);
  });

  describe('PostCard comment form', () => {
    const post = makeMessage({
      id: 1,
      game_id: 1,
      character_id: 1,
      character_name: 'GM Character',
      author_id: 100,
      author_username: 'gamemaster',
      content: 'A post to comment on',
      message_type: 'post',
      comment_count: 0,
    });

    function renderPost() {
      return renderWithProviders(
        <PostCard
          post={post}
          gameId={1}
          characters={characters}
          controllableCharacters={characters}
          onCreateComment={vi.fn()}
          currentUserId={100}
        />
      );
    }

    async function openFormAndType(user: ReturnType<typeof userEvent.setup>, text: string) {
      await user.click(screen.getByRole('button', { name: /add comment/i }));
      const editor = await screen.findByTestId('comment-editor');
      if (text) await user.type(editor, text);
      return editor;
    }

    it('closes the form immediately when the box is empty', async () => {
      const user = userEvent.setup();
      renderPost();

      await openFormAndType(user, '');
      await user.click(screen.getByRole('button', { name: /^cancel$/i }));

      expect(screen.queryByTestId('discard-comment-modal')).not.toBeInTheDocument();
      expect(screen.queryByTestId('comment-editor')).not.toBeInTheDocument();
    });

    it('closes the form immediately when the box holds only whitespace', async () => {
      const user = userEvent.setup();
      renderPost();

      await openFormAndType(user, '   ');
      await user.click(screen.getByRole('button', { name: /^cancel$/i }));

      expect(screen.queryByTestId('discard-comment-modal')).not.toBeInTheDocument();
      expect(screen.queryByTestId('comment-editor')).not.toBeInTheDocument();
    });

    it('asks for confirmation instead of discarding when the box has text', async () => {
      const user = userEvent.setup();
      renderPost();

      await openFormAndType(user, 'a comment worth keeping');
      await user.click(screen.getByRole('button', { name: /^cancel$/i }));

      expect(screen.getByTestId('discard-comment-modal')).toBeInTheDocument();
      // The form is still open and still holds the draft.
      expect(screen.getByTestId('comment-editor')).toHaveValue('a comment worth keeping');
    });

    it('keeps the draft when the confirmation is dismissed', async () => {
      const user = userEvent.setup();
      renderPost();

      await openFormAndType(user, 'a comment worth keeping');
      await user.click(screen.getByRole('button', { name: /^cancel$/i }));
      await user.click(screen.getByTestId('confirm-modal-cancel'));

      expect(screen.queryByTestId('discard-comment-modal')).not.toBeInTheDocument();
      expect(screen.getByTestId('comment-editor')).toHaveValue('a comment worth keeping');
    });

    it('discards the draft and closes the form when confirmed', async () => {
      const user = userEvent.setup();
      renderPost();

      await openFormAndType(user, 'a comment worth keeping');
      await user.click(screen.getByRole('button', { name: /^cancel$/i }));
      await user.click(screen.getByTestId('confirm-modal-confirm'));

      expect(screen.queryByTestId('discard-comment-modal')).not.toBeInTheDocument();
      expect(screen.queryByTestId('comment-editor')).not.toBeInTheDocument();
      // Reopening starts from a clean box rather than restoring the discarded draft.
      await user.click(screen.getByRole('button', { name: /add comment/i }));
      expect(await screen.findByTestId('comment-editor')).toHaveValue('');
    });
  });

  describe('ThreadedComment reply form', () => {
    const comment = makeMessage({
      id: 42,
      game_id: 1,
      author_id: 99,
      character_id: 1,
      character_name: 'Test Hero',
      author_username: 'testuser',
      content: 'A comment to reply to',
      message_type: 'comment',
      parent_id: 1,
      thread_depth: 1,
    });

    function renderThreadedComment() {
      return renderWithProviders(
        <ThreadedComment
          comment={comment}
          gameId={1}
          postId={1}
          characters={characters}
          controllableCharacters={characters}
          onCreateReply={vi.fn()}
          currentUserId={99}
        />
      );
    }

    async function openReplyAndType(user: ReturnType<typeof userEvent.setup>, text: string) {
      await user.click(screen.getByRole('button', { name: /reply to this comment/i }));
      const editor = await screen.findByTestId('comment-editor');
      if (text) await user.type(editor, text);
      return editor;
    }

    function replyFormCancel() {
      // The reply form's own Cancel, not a modal's.
      return screen
        .getAllByRole('button', { name: /^cancel$/i })
        .find((b) => !b.getAttribute('data-testid')?.startsWith('confirm-modal'))!;
    }

    it('closes the form immediately when the box is empty', async () => {
      const user = userEvent.setup();
      renderThreadedComment();

      await openReplyAndType(user, '');
      await user.click(replyFormCancel());

      expect(screen.queryByTestId('discard-reply-modal')).not.toBeInTheDocument();
      expect(screen.queryByTestId('comment-editor')).not.toBeInTheDocument();
    });

    it('closes the form immediately when the box holds only whitespace', async () => {
      const user = userEvent.setup();
      renderThreadedComment();

      await openReplyAndType(user, '   ');
      await user.click(replyFormCancel());

      expect(screen.queryByTestId('discard-reply-modal')).not.toBeInTheDocument();
      expect(screen.queryByTestId('comment-editor')).not.toBeInTheDocument();
    });

    it('asks for confirmation instead of discarding when the box has text', async () => {
      const user = userEvent.setup();
      renderThreadedComment();

      await openReplyAndType(user, 'a reply worth keeping');
      await user.click(replyFormCancel());

      const modal = screen.getByTestId('discard-reply-modal');
      expect(within(modal).getByTestId('confirm-modal-message')).toHaveTextContent(/unsaved text/i);
      expect(screen.getByTestId('comment-editor')).toHaveValue('a reply worth keeping');
    });

    it('keeps the draft when the confirmation is dismissed', async () => {
      const user = userEvent.setup();
      renderThreadedComment();

      await openReplyAndType(user, 'a reply worth keeping');
      await user.click(replyFormCancel());
      await user.click(screen.getByTestId('confirm-modal-cancel'));

      expect(screen.queryByTestId('discard-reply-modal')).not.toBeInTheDocument();
      expect(screen.getByTestId('comment-editor')).toHaveValue('a reply worth keeping');
    });

    it('discards the draft and closes the form when confirmed', async () => {
      const user = userEvent.setup();
      renderThreadedComment();

      await openReplyAndType(user, 'a reply worth keeping');
      await user.click(replyFormCancel());
      await user.click(screen.getByTestId('confirm-modal-confirm'));

      expect(screen.queryByTestId('discard-reply-modal')).not.toBeInTheDocument();
      expect(screen.queryByTestId('comment-editor')).not.toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: /reply to this comment/i }));
      expect(await screen.findByTestId('comment-editor')).toHaveValue('');
    });
  });

  // The New Comments page renders each hit as a CommentWithParentCard, which has
  // its own reply form rather than reusing ThreadedComment's. Its Cancel used to
  // be an inline setIsReplying(false)/setReplyContent('') that both skipped the
  // confirmation and left the autosave entry behind.
  describe('New Comments page card', () => {
    const comment: CommentWithParent = {
      id: 77,
      game_id: 1,
      parent_id: 100,
      post_id: 42,
      character_avatar_url: null,
      author_id: 10,
      character_id: 20,
      content: 'A comment surfaced on the New Comments page',
      created_at: '2025-10-22T10:00:00Z',
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

    function renderCard() {
      return renderWithProviders(
        <CommentWithParentCard comment={comment} gameId={1} />,
        { gameId: 1 }
      );
    }

    async function openReplyAndType(user: ReturnType<typeof userEvent.setup>, text: string) {
      await user.click(screen.getByRole('button', { name: /reply to this comment/i }));
      const editor = await screen.findByTestId('comment-editor');
      if (text) await user.type(editor, text);
      return editor;
    }

    it('closes the form immediately when the box is empty', async () => {
      const user = userEvent.setup({ delay: null });
      renderCard();

      await openReplyAndType(user, '');
      await user.click(screen.getByTestId('cancel-reply-button'));

      expect(screen.queryByTestId('discard-reply-modal')).not.toBeInTheDocument();
      expect(screen.queryByTestId('comment-editor')).not.toBeInTheDocument();
    });

    it('asks for confirmation instead of discarding when the box has text', async () => {
      const user = userEvent.setup({ delay: null });
      renderCard();

      await openReplyAndType(user, 'a reply worth keeping');
      await user.click(screen.getByTestId('cancel-reply-button'));

      expect(screen.getByTestId('discard-reply-modal')).toBeInTheDocument();
      expect(screen.getByTestId('comment-editor')).toHaveValue('a reply worth keeping');
    });

    it('keeps the draft when the confirmation is dismissed', async () => {
      const user = userEvent.setup({ delay: null });
      renderCard();

      await openReplyAndType(user, 'a reply worth keeping');
      await user.click(screen.getByTestId('cancel-reply-button'));
      await user.click(screen.getByTestId('confirm-modal-cancel'));

      expect(screen.queryByTestId('discard-reply-modal')).not.toBeInTheDocument();
      expect(screen.getByTestId('comment-editor')).toHaveValue('a reply worth keeping');
    });

    it('discards the draft and closes the form when confirmed', async () => {
      const user = userEvent.setup({ delay: null });
      renderCard();

      await openReplyAndType(user, 'a reply worth keeping');
      await user.click(screen.getByTestId('cancel-reply-button'));
      await user.click(screen.getByTestId('confirm-modal-confirm'));

      expect(screen.queryByTestId('discard-reply-modal')).not.toBeInTheDocument();
      expect(screen.queryByTestId('comment-editor')).not.toBeInTheDocument();
    });

    // The old inline Cancel cleared component state but left localStorage holding
    // the draft, so reopening the form silently restored text the user discarded.
    //
    // The cache is seeded directly rather than by typing: the stubbed editor
    // above stands in for the real CommentEditor, and writing the autosave entry
    // is the real editor's job (covered by CommentEditorAutosave.test.tsx). What
    // this asserts is the discard path clearing whatever is there.
    it('clears the autosave entry when the draft is discarded', async () => {
      const user = userEvent.setup({ delay: null });
      renderCard();

      const autosaveId = postCachingService.createAutosaveId('post-reply', comment.id);

      await openReplyAndType(user, 'Hello there');
      postCachingService.save(autosaveId, 'Hello there');
      expect(localStorage.getItem(autosaveId)).toContain('Hello there');

      await user.click(screen.getByTestId('cancel-reply-button'));
      await user.click(screen.getByTestId('confirm-modal-confirm'));

      expect(localStorage.getItem(autosaveId)).toBeNull();
    });
  });

  // A reply deep in a thread is still a ThreadedComment, just rendered at depth.
  // These pin that the guard survives nesting rather than only working on the
  // top-level instance the other cases exercise.
  describe('deeply nested comments', () => {
    // maxDepth defaults to 5; depth 4 is the deepest rung that still renders its
    // own reply form (at depth >= maxDepth the Reply button gives way to
    // "Continue this thread").
    const deepComment = makeMessage({
      id: 500,
      game_id: 1,
      author_id: 99,
      character_id: 1,
      character_name: 'Deep Hero',
      author_username: 'testuser',
      content: 'A deeply nested comment',
      message_type: 'comment',
      parent_id: 499,
      thread_depth: 4,
    });

    function renderDeep(depth: number) {
      return renderWithProviders(
        <ThreadedComment
          comment={deepComment}
          gameId={1}
          postId={1}
          characters={characters}
          controllableCharacters={characters}
          onCreateReply={vi.fn()}
          currentUserId={99}
          depth={depth}
        />
      );
    }

    it('guards the reply form at the deepest replyable rung', async () => {
      const user = userEvent.setup({ delay: null });
      renderDeep(4);

      await user.click(screen.getByRole('button', { name: /reply to this comment/i }));
      await user.type(await screen.findByTestId('comment-editor'), 'a deep reply');
      await user.click(screen.getByTestId('cancel-reply-button'));

      expect(screen.getByTestId('discard-reply-modal')).toBeInTheDocument();
      expect(screen.getByTestId('comment-editor')).toHaveValue('a deep reply');
    });

    it('keeps a deep draft when the confirmation is dismissed', async () => {
      const user = userEvent.setup({ delay: null });
      renderDeep(4);

      await user.click(screen.getByRole('button', { name: /reply to this comment/i }));
      await user.type(await screen.findByTestId('comment-editor'), 'a deep reply');
      await user.click(screen.getByTestId('cancel-reply-button'));
      await user.click(screen.getByTestId('confirm-modal-cancel'));

      expect(screen.getByTestId('comment-editor')).toHaveValue('a deep reply');
    });

    it('discards a deep draft when confirmed', async () => {
      const user = userEvent.setup({ delay: null });
      renderDeep(4);

      await user.click(screen.getByRole('button', { name: /reply to this comment/i }));
      await user.type(await screen.findByTestId('comment-editor'), 'a deep reply');
      await user.click(screen.getByTestId('cancel-reply-button'));
      await user.click(screen.getByTestId('confirm-modal-confirm'));

      expect(screen.queryByTestId('comment-editor')).not.toBeInTheDocument();
    });
  });
});
