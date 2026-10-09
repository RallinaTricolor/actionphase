import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ReactNode } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastProvider } from '@/contexts/ToastContext';
import { GlobalKeyboardShortcuts } from './GlobalKeyboardShortcuts';

function renderPage(content: ReactNode = null) {
  const user = userEvent.setup({ delay: null });
  render(
    <ToastProvider>
      <GlobalKeyboardShortcuts />
      {content}
    </ToastProvider>
  );
  return { user };
}

describe('GlobalKeyboardShortcuts', () => {
  describe('? cheat sheet', () => {
    it('opens on ? pressed outside a text box', async () => {
      const { user } = renderPage();

      await user.keyboard('?');

      expect(await screen.findByTestId('keyboard-shortcuts-help')).toBeInTheDocument();
      expect(screen.getByText('Jump to the next unread comment or message')).toBeInTheDocument();
      expect(screen.getByText('Insert the highlighted suggestion (Enter also works)')).toBeInTheDocument();
    });

    it('types a literal ? in a text box instead of opening', async () => {
      const { user } = renderPage(<textarea aria-label="comment" />);
      const textarea = screen.getByRole('textbox', { name: 'comment' });

      await user.type(textarea, 'Really?');

      expect(textarea).toHaveValue('Really?');
      expect(screen.queryByTestId('keyboard-shortcuts-help')).not.toBeInTheDocument();
    });

    it('stands aside while a dialog owns the keyboard', async () => {
      const { user } = renderPage(
        <div role="dialog">
          <button type="button">Inside</button>
        </div>
      );
      screen.getByRole('button', { name: 'Inside' }).focus();

      await user.keyboard('?');

      expect(screen.queryByTestId('keyboard-shortcuts-help')).not.toBeInTheDocument();
    });
  });

  describe('n: next unread', () => {
    const scrollIntoView = vi.fn();
    let originalGetClientRects: typeof Element.prototype.getClientRects;

    beforeEach(() => {
      scrollIntoView.mockClear();
      Element.prototype.scrollIntoView = scrollIntoView;
      // jsdom lays nothing out, so every element reports no boxes; treat all as rendered
      originalGetClientRects = Element.prototype.getClientRects;
      Element.prototype.getClientRects = () => [{}] as unknown as DOMRectList;
    });

    afterEach(() => {
      Element.prototype.getClientRects = originalGetClientRects;
    });

    it('scrolls the unread item into view', async () => {
      const { user } = renderPage(
        <>
          <div data-testid="read">read</div>
          <div data-testid="unread" data-unread-anchor="">unread</div>
        </>
      );

      await user.keyboard('n');

      expect(scrollIntoView).toHaveBeenCalledTimes(1);
      expect(scrollIntoView.mock.contexts[0]).toBe(screen.getByTestId('unread'));
    });

    it('says so when nothing on the page is unread', async () => {
      const { user } = renderPage(<div>all caught up</div>);

      await user.keyboard('n');

      expect(scrollIntoView).not.toHaveBeenCalled();
      expect(await screen.findByText('Nothing unread on this page')).toBeInTheDocument();
    });

    it('types a literal n in a text box', async () => {
      const { user } = renderPage(
        <>
          <input aria-label="search" />
          <div data-unread-anchor="">unread</div>
        </>
      );

      await user.type(screen.getByRole('textbox', { name: 'search' }), 'n');

      expect(scrollIntoView).not.toHaveBeenCalled();
    });

    it('jumps backward on Shift+n', async () => {
      const { user } = renderPage(
        <>
          <div data-testid="first" data-unread-anchor="">first</div>
          <div data-testid="last" data-unread-anchor="">last</div>
        </>
      );

      // jsdom puts everything at top 0, under the sticky nav, so nothing reads
      // as "above"; backward then wraps to the last item.
      await user.keyboard('{Shift>}n{/Shift}');

      expect(scrollIntoView.mock.contexts[0]).toBe(screen.getByTestId('last'));
    });

    it('treats a Caps Lock N without Shift as forward', () => {
      renderPage(
        <>
          <div data-testid="first" data-unread-anchor="">first</div>
          <div data-testid="last" data-unread-anchor="">last</div>
        </>
      );

      fireEvent.keyDown(document.body, { key: 'N', shiftKey: false });

      expect(scrollIntoView.mock.contexts[0]).toBe(screen.getByTestId('first'));
    });

    it('ignores modified combos like Ctrl+n', async () => {
      const { user } = renderPage(<div data-unread-anchor="">unread</div>);

      await user.keyboard('{Control>}n{/Control}');
      await user.keyboard('{Alt>}n{/Alt}');

      expect(scrollIntoView).not.toHaveBeenCalled();
    });
  });
});
