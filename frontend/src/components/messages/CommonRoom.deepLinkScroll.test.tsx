import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { waitFor } from '@testing-library/react';
import { http, HttpResponse, delay } from 'msw';
import { server } from '@/mocks/server';
import { renderWithProviders } from '@/test-utils/render';
import { CommonRoom } from './CommonRoom';
import type { Message } from '@/types/messages';
import { makeMessage } from '@/test-utils/factories';

/**
 * A deep link (?comment=) must land on the comment even when the post's
 * comments arrive late.
 *
 * The scroll used to look for the comment 100ms after the POSTS loaded. Each
 * post fetches its comments separately, so on a slow connection the comment
 * was not in the DOM yet: the deep link fell back to fetching the thread and
 * the page was never scrolled, leaving the comment far below the fold.
 */
const POST_ID = 1;
const TARGET_COMMENT_ID = 42;

const post = makeMessage({
  id: POST_ID,
  game_id: 1,
  character_id: 1,
  character_name: 'Test Character',
  content: 'A post',
  message_type: 'post',
});

const commentsResponse = (comments: Message[]) => ({
  comments,
  total_top_level: comments.length,
  returned_top_level: comments.length,
  returned_total: comments.length,
  has_more: false,
  limit: 5,
  offset: 0,
});

describe('CommonRoom deep-link scroll', () => {
  let threadContextRequested: boolean;
  const scrollIntoView = vi.fn();

  beforeEach(() => {
    threadContextRequested = false;
    scrollIntoView.mockClear();
    // jsdom does not implement scrolling.
    Element.prototype.scrollIntoView = scrollIntoView;
    server.use(
      http.get('/api/v1/auth/me', () => HttpResponse.json({ id: 1, username: 'testuser', email: 'test@example.com' })),
      http.get('/api/v1/games/:gameId/posts', () => HttpResponse.json([post])),
      http.get('/api/v1/games/:gameId/unread-comment-ids', () => HttpResponse.json([])),
      http.get('/api/v1/games/:gameId/messages/:messageId/thread-context', () => {
        threadContextRequested = true;
        return HttpResponse.json({ chain: [], root_post_id: POST_ID, has_full_thread: true });
      })
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('scrolls to a comment that renders after the posts have loaded', async () => {
    server.use(
      http.get('/api/v1/games/:gameId/posts/:postId/comments-with-threads', async () => {
        await delay(300);
        return HttpResponse.json(commentsResponse([
          makeMessage({ id: TARGET_COMMENT_ID, game_id: 1, parent_id: POST_ID, message_type: 'comment', content: 'The linked comment' }),
        ]));
      })
    );

    renderWithProviders(<CommonRoom gameId={1} />, {
      gameId: 1,
      initialEntries: [`/games/1?tab=common-room&comment=${TARGET_COMMENT_ID}`],
    });

    await waitFor(() => expect(scrollIntoView).toHaveBeenCalled(), { timeout: 3000 });
    const scrolledTo = scrollIntoView.mock.contexts[0] as Element;
    expect(scrolledTo.id).toMatch(new RegExp(`^comment-${TARGET_COMMENT_ID}(-desktop|-mobile)?$`));
    expect(threadContextRequested).toBe(false);
  });

  it('falls back to the thread view once comments have loaded without the target', async () => {
    server.use(
      http.get('/api/v1/games/:gameId/posts/:postId/comments-with-threads', async () => {
        await delay(300);
        return HttpResponse.json(commentsResponse([
          makeMessage({ id: 7, game_id: 1, parent_id: POST_ID, message_type: 'comment', content: 'Some other comment' }),
        ]));
      })
    );

    renderWithProviders(<CommonRoom gameId={1} />, {
      gameId: 1,
      initialEntries: [`/games/1?tab=common-room&comment=${TARGET_COMMENT_ID}`],
    });

    await waitFor(() => expect(threadContextRequested).toBe(true), { timeout: 3000 });
    expect(scrollIntoView).not.toHaveBeenCalled();
  });
});
