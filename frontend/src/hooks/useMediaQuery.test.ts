import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMediaQuery } from './useMediaQuery';

describe('useMediaQuery', () => {
  const original = window.matchMedia;
  afterEach(() => {
    window.matchMedia = original;
  });

  it('follows the query as it starts and stops matching', () => {
    let matches = true;
    const listeners = new Set<() => void>();
    window.matchMedia = vi.fn((media: string) => ({
      get matches() { return matches; },
      media,
      addEventListener: (_: string, fn: () => void) => listeners.add(fn),
      removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
    })) as unknown as typeof window.matchMedia;

    const { result, unmount } = renderHook(() => useMediaQuery('(max-width: 1023px)'));
    expect(result.current).toBe(true);

    act(() => {
      matches = false;
      listeners.forEach((fn) => fn());
    });
    expect(result.current).toBe(false);

    unmount();
    expect(listeners.size).toBe(0);
  });
});
