import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { MemoryRouter, useSearchParams } from 'react-router-dom';
import { useUrlParam } from '../useUrlParam';

// Helper: creates a wrapper with a given initial URL
const makeWrapper = (initialUrl = '/') =>
  ({ children }: { children: React.ReactNode }) => (
    <MemoryRouter initialEntries={[initialUrl]}>{children}</MemoryRouter>
  );

// Helper: reads all current search params from inside the router
function useCurrentParams() {
  const [params] = useSearchParams();
  return params;
}

describe('useUrlParam', () => {
  describe('string param', () => {
    it('returns defaultValue when param is absent', () => {
      const { result } = renderHook(() => useUrlParam('tab', 'posts'), {
        wrapper: makeWrapper('/'),
      });
      expect(result.current[0]).toBe('posts');
    });

    it('returns URL value when param is present', () => {
      const { result } = renderHook(() => useUrlParam('tab', 'posts'), {
        wrapper: makeWrapper('/?tab=history'),
      });
      expect(result.current[0]).toBe('history');
    });

    it('updates URL when setValue is called', () => {
      const { result } = renderHook(
        () => ({
          param: useUrlParam('subTab', 'submissions'),
          params: useCurrentParams(),
        }),
        { wrapper: makeWrapper('/') }
      );

      act(() => {
        result.current.param[1]('results');
      });

      expect(result.current.params.get('subTab')).toBe('results');
    });

    it('removes param from URL when setValue called with empty string', () => {
      const { result } = renderHook(
        () => ({
          param: useUrlParam('subTab', 'submissions'),
          params: useCurrentParams(),
        }),
        { wrapper: makeWrapper('/?subTab=results') }
      );

      act(() => {
        result.current.param[1]('' as 'submissions');
      });

      expect(result.current.params.get('subTab')).toBeNull();
    });
  });

  describe('nullable string param', () => {
    it('returns null default when param is absent', () => {
      const { result } = renderHook(() => useUrlParam<string | null>('comment', null), {
        wrapper: makeWrapper('/'),
      });
      expect(result.current[0]).toBeNull();
    });

    it('removes param when setValue called with null', () => {
      const { result } = renderHook(
        () => ({
          param: useUrlParam<string | null>('comment', null),
          params: useCurrentParams(),
        }),
        { wrapper: makeWrapper('/?comment=42') }
      );

      act(() => {
        result.current.param[1](null);
      });

      expect(result.current.params.get('comment')).toBeNull();
    });
  });

  describe('number param with custom deserializer', () => {
    const numOptions = {
      deserialize: (s: string) => parseInt(s, 10) || null,
      serialize: (v: number | null) => (v == null ? '' : String(v)),
    } as const;

    it('returns null when param is absent', () => {
      const { result } = renderHook(
        () => useUrlParam<number | null>('phase', null, numOptions),
        { wrapper: makeWrapper('/') }
      );
      expect(result.current[0]).toBeNull();
    });

    it('parses integer from URL', () => {
      const { result } = renderHook(
        () => useUrlParam<number | null>('phase', null, numOptions),
        { wrapper: makeWrapper('/?phase=5') }
      );
      expect(result.current[0]).toBe(5);
    });

    it('sets numeric param in URL', () => {
      const { result } = renderHook(
        () => ({
          param: useUrlParam<number | null>('phase', null, numOptions),
          params: useCurrentParams(),
        }),
        { wrapper: makeWrapper('/') }
      );

      act(() => {
        result.current.param[1](7);
      });

      expect(result.current.params.get('phase')).toBe('7');
    });

    it('removes param when set to null', () => {
      const { result } = renderHook(
        () => ({
          param: useUrlParam<number | null>('phase', null, numOptions),
          params: useCurrentParams(),
        }),
        { wrapper: makeWrapper('/?phase=5') }
      );

      act(() => {
        result.current.param[1](null);
      });

      expect(result.current.params.get('phase')).toBeNull();
    });
  });

  describe('preserves other params', () => {
    it('does not remove unrelated params when setting a value', () => {
      const { result } = renderHook(
        () => ({
          param: useUrlParam('subTab', 'submissions'),
          params: useCurrentParams(),
        }),
        { wrapper: makeWrapper('/?tab=history&comment=99') }
      );

      act(() => {
        result.current.param[1]('results');
      });

      expect(result.current.params.get('tab')).toBe('history');
      expect(result.current.params.get('comment')).toBe('99');
      expect(result.current.params.get('subTab')).toBe('results');
    });
  });
});
