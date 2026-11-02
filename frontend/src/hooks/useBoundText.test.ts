import { describe, it, expect } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useBoundText } from './useBoundText';

describe('useBoundText', () => {
  it('takes a new saved value while the box isn’t focused', () => {
    const { result, rerender } = renderHook(({ saved }) => useBoundText(saved), { initialProps: { saved: 'a' } });
    expect(result.current.text).toBe('a');
    rerender({ saved: 'b' });
    expect(result.current.text).toBe('b');
  });

  it('keeps what the GM is typing while focused, and catches up on blur', () => {
    const { result, rerender } = renderHook(({ saved }) => useBoundText(saved), { initialProps: { saved: 'a' } });
    act(() => result.current.bind.onFocus());
    act(() => result.current.setText('typing'));
    rerender({ saved: 'from a co-GM' });
    expect(result.current.text).toBe('typing');
    act(() => result.current.bind.onBlur());
    expect(result.current.text).toBe('from a co-GM');
  });
});
