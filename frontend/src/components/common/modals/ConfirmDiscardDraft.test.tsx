import { describe, it, expect, vi } from 'vitest';
import type { FormEvent } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmDiscardDraft } from './ConfirmDiscardDraft';

/**
 * The shared prompt behind every "your unsaved draft is about to be destroyed"
 * confirmation — the reply/comment Cancel buttons, closing a thread that holds a
 * pending reply, and navigating away from an editor. These cover the contract the
 * call sites depend on; each site's own trigger is covered where it lives.
 */
describe('ConfirmDiscardDraft', () => {
  const noop = () => {};

  it('renders nothing until it is open', () => {
    render(<ConfirmDiscardDraft isOpen={false} onKeepEditing={noop} onDiscard={noop} />);

    expect(screen.queryByTestId('discard-draft-modal')).not.toBeInTheDocument();
  });

  it('names the draft in the title and the default message', () => {
    render(<ConfirmDiscardDraft isOpen onKeepEditing={noop} onDiscard={noop} noun="reply" />);

    expect(screen.getByText('Discard reply?')).toBeInTheDocument();
    expect(screen.getByTestId('confirm-modal-message')).toHaveTextContent(
      'You have unsaved text in this reply. If you discard it, your changes will be lost.'
    );
  });

  it('takes an explicit message for callers whose draft is lost some other way', () => {
    render(
      <ConfirmDiscardDraft
        isOpen
        onKeepEditing={noop}
        onDiscard={noop}
        noun="reply"
        message="You have unsaved text in the reply editor. If you close this thread, your reply will be lost."
      />
    );

    expect(screen.getByTestId('confirm-modal-message')).toHaveTextContent(/close this thread/i);
  });

  // The two callbacks must stay distinct: wiring Keep editing to the discard path
  // would destroy the very draft the prompt exists to protect.
  it('calls only onKeepEditing when the prompt is dismissed', async () => {
    const user = userEvent.setup();
    const onKeepEditing = vi.fn();
    const onDiscard = vi.fn();
    render(<ConfirmDiscardDraft isOpen onKeepEditing={onKeepEditing} onDiscard={onDiscard} />);

    await user.click(screen.getByTestId('confirm-modal-cancel'));

    expect(onKeepEditing).toHaveBeenCalledOnce();
    expect(onDiscard).not.toHaveBeenCalled();
  });

  // Confirming is not symmetric with dismissing: ConfirmModal's confirm handler
  // runs `await onConfirm(); onClose();`, and onClose is our onKeepEditing, so
  // BOTH fire here. That is fine -- the draft is already discarded by the time
  // the prompt closes itself -- but only while the order holds. If onKeepEditing
  // ever ran first, a caller that reopens its editor on "keep editing" would
  // reopen it and then have the draft pulled out from under it.
  it('discards before dismissing when the discard is confirmed', async () => {
    const user = userEvent.setup();
    const calls: string[] = [];
    const onKeepEditing = vi.fn(() => calls.push('keepEditing'));
    const onDiscard = vi.fn(() => calls.push('discard'));
    render(<ConfirmDiscardDraft isOpen onKeepEditing={onKeepEditing} onDiscard={onDiscard} />);

    await user.click(screen.getByTestId('confirm-modal-confirm'));

    expect(onDiscard).toHaveBeenCalledOnce();
    expect(calls).toEqual(['discard', 'keepEditing']);
  });

  it('labels the actions so neither reads as the safe default', () => {
    render(<ConfirmDiscardDraft isOpen onKeepEditing={noop} onDiscard={noop} />);

    expect(screen.getByTestId('confirm-modal-cancel')).toHaveTextContent('Keep editing');
    expect(screen.getByTestId('confirm-modal-confirm')).toHaveTextContent('Discard');
  });

  // Regression: Modal renders in place rather than portaling, so this prompt sits
  // inside whatever <form> its caller lives in -- CreatePostForm wraps the comment
  // editor that owns the navigation guard. With no explicit type, the buttons
  // default to type="submit", so dismissing or confirming submitted that form and
  // published the draft the prompt was asking about. Caught as an E2E failure:
  // clicking Discard to leave the page created a post.
  it('never submits a form it is rendered inside', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn((e: FormEvent) => e.preventDefault());

    render(
      <form onSubmit={onSubmit}>
        <ConfirmDiscardDraft isOpen onKeepEditing={noop} onDiscard={noop} />
      </form>
    );

    await user.click(screen.getByTestId('confirm-modal-confirm'));
    await user.click(screen.getByTestId('confirm-modal-cancel'));

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('scopes itself with a caller-supplied testId', () => {
    render(
      <ConfirmDiscardDraft isOpen onKeepEditing={noop} onDiscard={noop} testId="discard-reply-modal" />
    );

    expect(screen.getByTestId('discard-reply-modal')).toBeInTheDocument();
    expect(screen.queryByTestId('discard-draft-modal')).not.toBeInTheDocument();
  });
});
