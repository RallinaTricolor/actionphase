import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';
import { renderWithProviders } from '@/test-utils/render';
import { makeCharacter, makeMessage } from '@/test-utils/factories';
import type { Message } from '@/types/messages';
import { PostRestriction, PostViewersButton } from './PostRestriction';

const GM = 1;
const CO_GM = 2;
const AUDIENCE = 3;
const ADMIN = 4; // a site admin who isn't in the game
const AMY = 10;
const ZED = 11;
const GONE = 12;

const participants = [
  { id: 1, game_id: 1, user_id: CO_GM, username: 'cog', role: 'co_gm', status: 'active' },
  { id: 2, game_id: 1, user_id: AUDIENCE, username: 'aud', role: 'audience', status: 'active' },
  { id: 3, game_id: 1, user_id: AMY, username: 'amy', role: 'player', status: 'active' },
  { id: 4, game_id: 1, user_id: ZED, username: 'zed', role: 'player', status: 'active' },
  { id: 5, game_id: 1, user_id: GONE, username: 'gone', role: 'player', status: 'removed' },
];

const characters = [
  makeCharacter({ id: 1, game_id: 1, user_id: AMY, name: 'Brynn', character_type: 'player_character' }),
  makeCharacter({ id: 2, game_id: 1, user_id: ZED, name: 'Corvo', character_type: 'player_character' }),
  makeCharacter({ id: 3, game_id: 1, user_id: GONE, name: 'Old Hero', character_type: 'player_character' }),
];

// Counts the GameContext requests answered, so a test can wait for the role
// to resolve before asserting that something is absent.
let contextResponses = 0;

function setupGame({ userId, state = 'in_progress', isAdmin = false }: { userId: number; state?: string; isAdmin?: boolean }) {
  contextResponses = 0;
  server.use(
    http.get('/api/v1/auth/me', () =>
      HttpResponse.json({ id: userId, username: `user${userId}`, email: 'u@example.com', is_admin: isAdmin })
    ),
    http.get('/api/v1/games/:gameId/details', ({ params }) => {
      contextResponses++;
      return HttpResponse.json({
        id: Number(params.gameId),
        title: 'Test Game',
        description: '',
        gm_user_id: GM,
        gm_username: 'thegm',
        state,
        is_anonymous: false,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      });
    }),
    http.get('/api/v1/games/:gameId/participants', () => {
      contextResponses++;
      return HttpResponse.json(participants);
    }),
    http.get('/api/v1/games/:gameId/characters', () => {
      contextResponses++;
      return HttpResponse.json(characters);
    }),
    http.get('/api/v1/games/:gameId/characters/controllable', () => HttpResponse.json([]))
  );
}

const publicPost: Message = makeMessage({ id: 50, game_id: 1, message_type: 'post', is_restricted: false });
// What a listed player gets: the flag, never the list.
const restrictedPost: Message = makeMessage({ id: 51, game_id: 1, message_type: 'post', is_restricted: true });
// What the GM, co-GMs and audience get.
const restrictedWithViewers: Message = { ...restrictedPost, viewer_user_ids: [AMY] };

function renderRestriction(post: Message, onPostUpdated = vi.fn()) {
  renderWithProviders(
    <>
      <PostRestriction post={post} />
      <PostViewersButton post={post} onPostUpdated={onPostUpdated} />
    </>,
    { gameId: 1 }
  );
  return onPostUpdated;
}

// GameContext loads asynchronously; the edit action is the last thing to settle.
async function waitForRole() {
  await waitFor(() => expect(screen.getByTestId('edit-post-viewers')).toBeInTheDocument());
}

// For asserting absence: every context request answered, then a render pass.
async function waitForContext() {
  await waitFor(() => expect(contextResponses).toBeGreaterThanOrEqual(3));
  await new Promise((r) => setTimeout(r, 50));
}

describe('PostRestriction and PostViewersButton', () => {
  describe('what each viewer sees', () => {
    it('shows nothing on a public post to a player', async () => {
      setupGame({ userId: AMY });
      renderRestriction(publicPost);
      await waitForContext();
      expect(screen.queryByTestId('post-restriction')).not.toBeInTheDocument();
    });

    it('shows a listed player the badge but not the list or the edit action', async () => {
      setupGame({ userId: AMY });
      renderRestriction(restrictedPost);
      expect(await screen.findByTestId('restricted-badge')).toHaveTextContent('Restricted');
      await waitForContext();
      expect(screen.queryByTestId('post-viewer-names')).not.toBeInTheDocument();
      expect(screen.queryByTestId('edit-post-viewers')).not.toBeInTheDocument();
    });

    it('shows the audience who can see it, without the edit action', async () => {
      setupGame({ userId: AUDIENCE });
      renderRestriction(restrictedWithViewers);
      await waitFor(() =>
        expect(screen.getByTestId('post-viewer-names')).toHaveTextContent('Visible to Brynn')
      );
      await waitForContext();
      expect(screen.queryByTestId('edit-post-viewers')).not.toBeInTheDocument();
    });

    it.each([
      ['the GM', GM],
      ['a co-GM', CO_GM],
    ])('offers %s the edit action', async (_name, userId) => {
      setupGame({ userId });
      renderRestriction(restrictedWithViewers);
      await waitForRole();
      expect(screen.getByTestId('edit-post-viewers')).toHaveTextContent('Edit viewers');
    });

    describe('a site admin', () => {
      afterEach(() => localStorage.removeItem('admin_mode_enabled'));

      it('gets the edit action with admin mode on', async () => {
        localStorage.setItem('admin_mode_enabled', 'true');
        setupGame({ userId: ADMIN, isAdmin: true });
        renderRestriction(restrictedWithViewers);
        await waitForRole();
        expect(screen.getByTestId('edit-post-viewers')).toHaveTextContent('Edit viewers');
      });

      it('does not get it with admin mode off', async () => {
        setupGame({ userId: ADMIN, isAdmin: true });
        renderRestriction(restrictedWithViewers);
        await waitForContext();
        expect(screen.getByTestId('restricted-badge')).toBeInTheDocument();
        expect(screen.queryByTestId('edit-post-viewers')).not.toBeInTheDocument();
      });
    });

    it('offers the GM "Restrict" on a public post', async () => {
      setupGame({ userId: GM });
      renderRestriction(publicPost);
      await waitForRole();
      expect(screen.getByTestId('edit-post-viewers')).toHaveTextContent('Restrict');
      expect(screen.queryByTestId('restricted-badge')).not.toBeInTheDocument();
    });

    it('hides the edit action once the game is completed', async () => {
      setupGame({ userId: GM, state: 'completed' });
      renderRestriction(restrictedWithViewers);
      await waitFor(() =>
        expect(screen.getByTestId('post-viewer-names')).toHaveTextContent('Visible to Brynn')
      );
      await waitForContext();
      expect(screen.queryByTestId('edit-post-viewers')).not.toBeInTheDocument();
    });
  });

  describe('editing the list', () => {
    function captureSave(response: Message | { status: number; detail: string }) {
      const bodies: unknown[] = [];
      server.use(
        http.put('/api/v1/games/:gameId/posts/:postId/viewers', async ({ request }) => {
          bodies.push(await request.json());
          if ('status' in response) {
            return HttpResponse.json({ detail: response.detail }, { status: response.status });
          }
          return HttpResponse.json(response);
        })
      );
      return bodies;
    }

    it('replaces the list and hands back the updated post', async () => {
      const user = userEvent.setup();
      setupGame({ userId: GM });
      const updated = { ...restrictedWithViewers, viewer_user_ids: [ZED] };
      const bodies = captureSave(updated);
      const onPostUpdated = renderRestriction(restrictedWithViewers);
      await waitForRole();

      await user.click(screen.getByTestId('edit-post-viewers'));
      expect(screen.getByText(/lose the whole thread/i)).toBeInTheDocument();
      expect(screen.getByText(/can't be recalled/i)).toBeInTheDocument();
      expect(screen.getByLabelText('Brynn')).toBeChecked();

      await user.click(screen.getByLabelText('Brynn'));
      expect(screen.getByTestId('save-post-viewers')).toBeDisabled();
      await user.click(screen.getByLabelText('Corvo'));
      await user.click(screen.getByTestId('save-post-viewers'));

      await waitFor(() => expect(onPostUpdated).toHaveBeenCalledWith(updated));
      expect(bodies).toEqual([{ restricted: true, user_ids: [ZED] }]);
      expect(screen.queryByTestId('post-viewers-modal')).not.toBeInTheDocument();
    });

    it('makes the post public without a list', async () => {
      const user = userEvent.setup();
      setupGame({ userId: GM });
      const bodies = captureSave(publicPost);
      renderRestriction(restrictedWithViewers);
      await waitForRole();

      await user.click(screen.getByTestId('edit-post-viewers'));
      await user.click(screen.getByTestId('restrict-post-toggle'));
      await user.click(screen.getByTestId('save-post-viewers'));

      await waitFor(() => expect(bodies).toEqual([{ restricted: false }]));
    });

    it('names a listed player who has left and drops them on save', async () => {
      const user = userEvent.setup();
      setupGame({ userId: GM });
      const bodies = captureSave(restrictedWithViewers);
      renderRestriction({ ...restrictedPost, viewer_user_ids: [AMY, GONE] });
      await waitForRole();

      await user.click(screen.getByTestId('edit-post-viewers'));
      expect(screen.getByTestId('departed-viewers-note')).toHaveTextContent('Old Hero is no longer an active player');
      await user.click(screen.getByTestId('save-post-viewers'));

      await waitFor(() => expect(bodies).toEqual([{ restricted: true, user_ids: [AMY] }]));
    });

    it('shows the server error and keeps the modal open', async () => {
      const user = userEvent.setup();
      setupGame({ userId: GM });
      captureSave({ status: 422, detail: 'every viewer must be an active player in this game' });
      const onPostUpdated = renderRestriction(restrictedWithViewers);
      await waitForRole();

      await user.click(screen.getByTestId('edit-post-viewers'));
      await user.click(screen.getByTestId('save-post-viewers'));

      expect(await screen.findByText(/every viewer must be an active player/i)).toBeInTheDocument();
      expect(screen.getByTestId('post-viewers-modal')).toBeInTheDocument();
      expect(onPostUpdated).not.toHaveBeenCalled();
    });
  });
});
