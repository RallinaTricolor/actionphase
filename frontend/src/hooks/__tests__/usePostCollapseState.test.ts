import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePostCollapseState } from '../usePostCollapseState';

describe('usePostCollapseState', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns default collapsed state (false) when no stored value', () => {
    const { result } = renderHook(() => usePostCollapseState(123));
    expect(result.current[0]).toBe(false);
  });

  it('accepts custom default collapsed state', () => {
    const { result } = renderHook(() => usePostCollapseState(123, true));
    expect(result.current[0]).toBe(true);
  });

  it('persists collapse state to localStorage', () => {
    const { result } = renderHook(() => usePostCollapseState(123));

    act(() => {
      result.current[1](true); // Collapse
    });

    const stored = JSON.parse(localStorage.getItem('postCollapseState') || '{}');
    expect(stored['123']).toBe(true);
  });

  it('loads collapse state from localStorage', () => {
    // Pre-populate localStorage
    localStorage.setItem('postCollapseState', JSON.stringify({ '123': true }));

    const { result } = renderHook(() => usePostCollapseState(123));
    expect(result.current[0]).toBe(true);
  });

  it('handles multiple posts independently', () => {
    const { result: result1 } = renderHook(() => usePostCollapseState(123));
    const { result: result2 } = renderHook(() => usePostCollapseState(456));

    act(() => {
      result1.current[1](true); // Collapse post 123
    });

    act(() => {
      result2.current[1](false); // Expand post 456
    });

    const stored = JSON.parse(localStorage.getItem('postCollapseState') || '{}');
    expect(stored['123']).toBe(true);
    expect(stored['456']).toBe(false);
  });

  it('handles localStorage errors gracefully', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Mock localStorage.setItem to throw error
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Storage quota exceeded');
    });

    const { result } = renderHook(() => usePostCollapseState(123));

    act(() => {
      result.current[1](true); // Should not crash
    });

    expect(consoleErrorSpy).toHaveBeenCalled();

    setItemSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it('updates localStorage when state changes', () => {
    const { result } = renderHook(() => usePostCollapseState(123));

    // Initially expanded (false)
    expect(result.current[0]).toBe(false);

    // Collapse
    act(() => {
      result.current[1](true);
    });

    let stored = JSON.parse(localStorage.getItem('postCollapseState') || '{}');
    expect(stored['123']).toBe(true);

    // Expand again
    act(() => {
      result.current[1](false);
    });

    stored = JSON.parse(localStorage.getItem('postCollapseState') || '{}');
    expect(stored['123']).toBe(false);
  });
});
