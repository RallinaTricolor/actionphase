import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { server } from '../mocks/server';
import {
  useGameFavoriteCommentIDs,
  useFavoriteCommentIDs,
  useFavoriteComments,
  useSetCommentFavorite,
} from './useFavorites';

// Uses the shared MSW server from src/mocks/server rather than a local
// setupServer(). Both listen at once, and the shared one wins, so a local
// server's handlers never match -- requests fall through as unhandled and
// tests can pass for the wrong reason. src/mocks/server.ts documents this.

describe('useFavorites hooks', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  describe('useGameFavoriteCommentIDs', () => {
    it('exposes the game\'s favorited ids as a Set', async () => {
      server.use(
        http.get('/api/v1/games/7/favorite-comment-ids', () =>
          HttpResponse.json({ favorite_comment_ids: [101, 102] })
        )
      );

      const { result } = renderHook(() => useGameFavoriteCommentIDs(7), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.favoriteIds).toBeInstanceOf(Set);
      expect(result.current.favoriteIds.has(101)).toBe(true);
      expect(result.current.favoriteIds.has(999)).toBe(false);
    });

    it('is disabled without a game id, and still yields an empty Set', () => {
      const { result } = renderHook(() => useGameFavoriteCommentIDs(undefined), { wrapper });

      expect(result.current.data).toBeUndefined();
      expect(result.current.isError).toBe(false);
      expect(result.current.favoriteIds.size).toBe(0);
    });
  });

  describe('useFavoriteCommentIDs', () => {
    it('fetches the cross-game id set', async () => {
      server.use(
        http.get('/api/v1/favorites/comment-ids', () =>
          HttpResponse.json({ favorite_comment_ids: [5, 6, 7] })
        )
      );

      const { result } = renderHook(() => useFavoriteCommentIDs(), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect([...result.current.favoriteIds].sort()).toEqual([5, 6, 7]);
    });
  });

  describe('useFavoriteComments', () => {
    it('requests the first page without a cursor and stops when none comes back', async () => {
      server.use(
        http.get('/api/v1/favorites/comments', ({ request }) => {
          const url = new URL(request.url);
          expect(url.searchParams.get('limit')).toBe('20');
          // The first page is addressed by the absence of a cursor, not by
          // offset=0.
          expect(url.searchParams.has('cursor')).toBe(false);
          expect(url.searchParams.has('offset')).toBe(false);
          return HttpResponse.json({
            favorites: [
              {
                id: 1,
                game_id: 3,
                game_title: 'Nightfall',
                content: 'starred',
                favorited_at: '2026-09-10T12:00:00Z',
              },
            ],
            pagination: { limit: 20, next_cursor: null },
          });
        })
      );

      const { result } = renderHook(() => useFavoriteComments(), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.pages[0].favorites).toHaveLength(1);
      expect(result.current.data?.pages[0].favorites[0].game_title).toBe('Nightfall');
      // A null next_cursor is the end of the list.
      expect(result.current.hasNextPage).toBe(false);
    });

    it('sends the previous page cursor when fetching the next page', async () => {
      const seenCursors: (string | null)[] = [];
      server.use(
        http.get('/api/v1/favorites/comments', ({ request }) => {
          const url = new URL(request.url);
          seenCursors.push(url.searchParams.get('cursor'));
          const isFirst = !url.searchParams.get('cursor');
          return HttpResponse.json({
            favorites: [
              {
                id: isFirst ? 1 : 2,
                game_id: 3,
                game_title: 'Nightfall',
                content: isFirst ? 'first' : 'second',
                favorited_at: '2026-09-10T12:00:00Z',
              },
            ],
            pagination: { limit: 20, next_cursor: isFirst ? 'CURSOR_ONE' : null },
          });
        })
      );

      const { result } = renderHook(() => useFavoriteComments(), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.hasNextPage).toBe(true);

      result.current.fetchNextPage();

      await waitFor(() => expect(result.current.data?.pages).toHaveLength(2));

      // The second request carries the cursor the first response handed back.
      expect(seenCursors).toEqual([null, 'CURSOR_ONE']);
      expect(result.current.data?.pages[1].favorites[0].content).toBe('second');
      expect(result.current.hasNextPage).toBe(false);
    });

    // Regression: favoriting happens away from /favorites and deliberately
    // does not invalidate this listing, so remounting the page is the only
    // thing that picks the new star up. The app-wide default staleTime is 5
    // minutes, which kept the cached pages fresh across that remount and left
    // /favorites showing a stale list until a manual reload. This client
    // mirrors the app default, so the hook's own staleTime: 0 is what makes it
    // pass.
    it('refetches on remount even under the app-wide staleTime', async () => {
      const staleClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false, staleTime: 5 * 60 * 1000 },
          mutations: { retry: false },
        },
      });
      const staleWrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={staleClient}>{children}</QueryClientProvider>
      );

      let requestCount = 0;
      server.use(
        http.get('/api/v1/favorites/comments', () => {
          requestCount += 1;
          return HttpResponse.json({
            favorites:
              requestCount === 1
                ? []
                : [
                    {
                      id: 7,
                      game_id: 3,
                      game_title: 'Nightfall',
                      content: 'starred while away',
                      favorited_at: '2026-09-10T12:00:00Z',
                    },
                  ],
            pagination: { limit: 20, next_cursor: null },
          });
        })
      );

      // Visit /favorites: nothing starred yet.
      const first = renderHook(() => useFavoriteComments(), { wrapper: staleWrapper });
      await waitFor(() => expect(first.result.current.isSuccess).toBe(true));
      expect(first.result.current.data?.pages[0].favorites).toHaveLength(0);

      // Leave the page, star a comment elsewhere, come back.
      first.unmount();
      const second = renderHook(() => useFavoriteComments(), { wrapper: staleWrapper });

      await waitFor(() =>
        expect(second.result.current.data?.pages[0].favorites).toHaveLength(1)
      );
      expect(second.result.current.data?.pages[0].favorites[0].content).toBe(
        'starred while away'
      );
      expect(requestCount).toBe(2);
    });
  });

  describe('useSetCommentFavorite', () => {
    // Seed both id caches, so we can prove the optimistic write reaches every
    // surface a comment might be visible on -- not just the one being clicked.
    const seedCaches = () => {
      queryClient.setQueryData(['favoriteCommentIDs', 7], [101]);
      queryClient.setQueryData(['favoriteCommentIDs', 'all'], [101]);
    };

    it('adds the id to every cached set before the request resolves', async () => {
      let release: () => void = () => {};
      const blocked = new Promise<void>((resolve) => {
        release = resolve;
      });

      server.use(
        http.put('/api/v1/comments/202/favorite', async () => {
          await blocked;
          return new HttpResponse(null, { status: 204 });
        })
      );

      seedCaches();
      const { result } = renderHook(() => useSetCommentFavorite(), { wrapper });

      act(() => {
        result.current.mutate({ commentId: 202, favorite: true });
      });

      // Still in flight, but the caches already show the star.
      await waitFor(() => {
        expect(queryClient.getQueryData(['favoriteCommentIDs', 7])).toContain(202);
      });
      expect(queryClient.getQueryData(['favoriteCommentIDs', 'all'])).toContain(202);

      release();
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });

    it('removes the id optimistically when unfavoriting', async () => {
      server.use(
        http.put('/api/v1/comments/101/favorite', () => new HttpResponse(null, { status: 204 }))
      );

      seedCaches();
      const { result } = renderHook(() => useSetCommentFavorite(), { wrapper });

      act(() => {
        result.current.mutate({ commentId: 101, favorite: false });
      });

      await waitFor(() => {
        expect(queryClient.getQueryData(['favoriteCommentIDs', 7])).not.toContain(101);
      });
      expect(queryClient.getQueryData(['favoriteCommentIDs', 'all'])).not.toContain(101);
    });

    it('rolls every cache back when the request fails', async () => {
      server.use(
        http.put('/api/v1/comments/202/favorite', () => new HttpResponse(null, { status: 500 }))
      );

      seedCaches();
      const { result } = renderHook(() => useSetCommentFavorite(), { wrapper });

      act(() => {
        result.current.mutate({ commentId: 202, favorite: true });
      });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(queryClient.getQueryData(['favoriteCommentIDs', 7])).toEqual([101]);
      expect(queryClient.getQueryData(['favoriteCommentIDs', 'all'])).toEqual([101]);
    });

    it('does not duplicate an id that is already starred', async () => {
      server.use(
        http.put('/api/v1/comments/101/favorite', () => new HttpResponse(null, { status: 204 }))
      );

      seedCaches();
      const { result } = renderHook(() => useSetCommentFavorite(), { wrapper });

      act(() => {
        result.current.mutate({ commentId: 101, favorite: true });
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      const ids = queryClient.getQueryData<number[]>(['favoriteCommentIDs', 7]) ?? [];
      expect(ids.filter((id) => id === 101)).toHaveLength(1);
    });
  });
});
