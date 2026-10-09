import { describe, it, expect } from 'vitest';
import { MOD, isEditableTarget, isSubmitCombo, keyLabel, pickUnread } from './keyboardShortcuts';

const combo = (overrides: Partial<{ key: string; ctrlKey: boolean; metaKey: boolean; altKey: boolean }>) => ({
  key: 'Enter',
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  ...overrides,
});

describe('isSubmitCombo', () => {
  it('matches Ctrl+Enter and ⌘+Enter', () => {
    expect(isSubmitCombo(combo({ ctrlKey: true }))).toBe(true);
    expect(isSubmitCombo(combo({ metaKey: true }))).toBe(true);
  });

  it('ignores a plain Enter, which types a newline', () => {
    expect(isSubmitCombo(combo({}))).toBe(false);
  });

  it('leaves Alt combos to the OS', () => {
    expect(isSubmitCombo(combo({ ctrlKey: true, altKey: true }))).toBe(false);
  });
});

describe('keyLabel', () => {
  it('renders the modifier per platform', () => {
    expect(keyLabel(MOD, true)).toBe('⌘');
    expect(keyLabel(MOD, false)).toBe('Ctrl');
  });

  it('passes ordinary keys through', () => {
    expect(keyLabel('Enter', true)).toBe('Enter');
  });
});

describe('isEditableTarget', () => {
  const make = <K extends keyof HTMLElementTagNameMap>(tag: K, setup?: (el: HTMLElementTagNameMap[K]) => void) => {
    const el = document.createElement(tag);
    setup?.(el);
    return el;
  };

  it.each([
    ['textarea', make('textarea')],
    ['text input', make('input')],
    ['search input', make('input', (el) => { el.type = 'search'; })],
    ['select', make('select')],
  ])('treats a %s as editable', (_label, el) => {
    expect(isEditableTarget(el)).toBe(true);
  });

  it('treats contenteditable as editable', () => {
    const el = make('div');
    // jsdom does not derive isContentEditable from the attribute
    Object.defineProperty(el, 'isContentEditable', { value: true });
    expect(isEditableTarget(el)).toBe(true);
  });

  it.each([
    ['checkbox', make('input', (el) => { el.type = 'checkbox'; })],
    ['button', make('button')],
    ['plain div', make('div')],
  ])('does not treat a %s as editable', (_label, el) => {
    expect(isEditableTarget(el)).toBe(false);
  });

  it('handles a null target', () => {
    expect(isEditableTarget(null)).toBe(false);
  });
});

describe('pickUnread', () => {
  /** A stand-in anchor at a fixed viewport position. */
  const at = (top: number, height = 100) =>
    ({ getBoundingClientRect: () => ({ top, bottom: top + height }) }) as unknown as Element;
  const viewport = { visibleTop: 64, viewportHeight: 800 };

  it('returns null when nothing is unread', () => {
    expect(pickUnread([], 'next', { previous: null, ...viewport })).toBeNull();
    expect(pickUnread([], 'previous', { previous: null, ...viewport })).toBeNull();
  });

  describe('next (n)', () => {
    it('starts at the first anchor at or below the visible top', () => {
      const above = at(-500);
      const below = at(300);
      expect(pickUnread([above, below], 'next', { previous: null, ...viewport })).toBe(below);
    });

    it('steps past the previous jump while it is still on screen', () => {
      // After a jump the previous target sits mid-viewport; the next one may be
      // on screen too, and must still be chosen over re-picking the previous.
      const previous = at(350);
      const next = at(500);
      expect(pickUnread([previous, next], 'next', { previous, ...viewport })).toBe(next);
    });

    it('starts over from the viewport once the previous jump is scrolled away', () => {
      const previous = at(-2000);
      const passed = at(-1000);
      const ahead = at(400);
      expect(pickUnread([previous, passed, ahead], 'next', { previous, ...viewport })).toBe(ahead);
    });

    it('wraps to the first anchor past the last', () => {
      const first = at(-1000);
      const last = at(300);
      expect(pickUnread([first, last], 'next', { previous: last, ...viewport })).toBe(first);
      expect(pickUnread([first], 'next', { previous: null, ...viewport })).toBe(first);
    });
  });

  describe('previous (Shift+n)', () => {
    it('starts at the last anchor above the visible top', () => {
      const farAbove = at(-1500);
      const justAbove = at(-400);
      const onScreen = at(300);
      expect(pickUnread([farAbove, justAbove, onScreen], 'previous', { previous: null, ...viewport })).toBe(justAbove);
    });

    it('steps back from the previous jump while it is still on screen', () => {
      const earlier = at(100);
      const previous = at(350);
      expect(pickUnread([earlier, previous], 'previous', { previous, ...viewport })).toBe(earlier);
    });

    it('wraps to the last anchor before the first', () => {
      const first = at(350);
      const last = at(2000);
      expect(pickUnread([first, last], 'previous', { previous: first, ...viewport })).toBe(last);
      // Nothing above the viewport at all: wrap rather than stand still
      expect(pickUnread([first, last], 'previous', { previous: null, ...viewport })).toBe(last);
    });

    it('reverses a run of n presses', () => {
      const a = at(200);
      const b = at(400);
      const c = at(600);
      const anchors = [a, b, c];
      expect(pickUnread(anchors, 'next', { previous: a, ...viewport })).toBe(b);
      expect(pickUnread(anchors, 'previous', { previous: b, ...viewport })).toBe(a);
    });
  });
});
