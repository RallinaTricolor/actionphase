import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useArrowMode } from './useArrowMode';

describe('useArrowMode', () => {
  beforeEach(() => localStorage.clear());

  it('starts on hover', () => {
    expect(renderHook(() => useArrowMode()).result.current[0]).toBe('hover');
  });

  it('remembers the choice for the next board', () => {
    const first = renderHook(() => useArrowMode());
    act(() => first.result.current[1]('all'));
    expect(first.result.current[0]).toBe('all');
    expect(renderHook(() => useArrowMode()).result.current[0]).toBe('all');
  });

  it('ignores a stored value it doesn’t know', () => {
    localStorage.setItem('gmBoardArrows', 'sideways');
    expect(renderHook(() => useArrowMode()).result.current[0]).toBe('hover');
  });

  it('still works when storage throws', () => {
    const get = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const { result } = renderHook(() => useArrowMode());
    expect(result.current[0]).toBe('hover');
    act(() => result.current[1]('off'));
    expect(result.current[0]).toBe('off');
    get.mockRestore();
    set.mockRestore();
  });
});
