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
    it('requests the first page and stops paging on a short page', async () => {
      server.use(
        http.get('/api/v1/favorites/comments', ({ request }) => {
          const url = new URL(request.url);
          expect(url.searchParams.get('limit')).toBe('20');
          expect(url.searchParams.get('offset')).toBe('0');
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
            pagination: { limit: 20, offset: 0, total: 1 },
          });
        })
      );

      const { result } = renderHook(() => useFavoriteComments(), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.pages[0].favorites).toHaveLength(1);
      expect(result.current.data?.pages[0].favorites[0].game_title).toBe('Nightfall');
      // A page shorter than the page size means there is nothing after it.
      expect(result.current.hasNextPage).toBe(false);
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
