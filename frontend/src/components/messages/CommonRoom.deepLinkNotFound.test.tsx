import { describe, it, expect, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';
import { renderWithProviders } from '@/test-utils/render';
import { makeMessage } from '@/test-utils/factories';
import { CommonRoom } from './CommonRoom';

/**
 * A deep link (usually a notification) to a comment the viewer can't load.
 * The API answers a missing comment and one in a restricted thread hidden from
 * the viewer with the same 404, so both land here. The room must stay usable:
 * a dismissible notice, not the error screen or an endless spinner.
 */
describe('CommonRoom deep link to a comment that 404s', () => {
  beforeEach(() => {
    server.use(
      http.get('/api/v1/games/:gameId/posts', () =>
        HttpResponse.json([
          makeMessage({ id: 1, game_id: 1, message_type: 'post', content: 'A visible post' }),
        ])
      ),
      http.get('/api/v1/games/:gameId/unread-comment-ids', () => HttpResponse.json([])),
      http.get('/api/v1/games/:gameId/messages/:messageId/thread-context', () =>
        HttpResponse.json({ title: 'Not Found', status: 404, detail: 'message not found' }, { status: 404 })
      )
    );
  });

  it('shows a notice over the room and clears the link', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CommonRoom gameId={1} />, {
      gameId: 1,
      initialEntries: ['/games/1?tab=common-room&comment=999'],
    });

    const notice = await screen.findByTestId('deep-link-not-found');
    expect(notice).toHaveTextContent(/couldn't be found/i);
    expect(screen.queryByText(/Loading comment/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /try again/i })).not.toBeInTheDocument();
    // The room is still there.
    expect(screen.getByText('A visible post')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /dismiss/i }));
    await waitFor(() => expect(screen.queryByTestId('deep-link-not-found')).not.toBeInTheDocument());
  });
});
