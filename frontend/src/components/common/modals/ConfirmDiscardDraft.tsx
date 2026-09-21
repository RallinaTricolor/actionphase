import { ConfirmModal } from './ConfirmModal';

interface ConfirmDiscardDraftProps {
  isOpen: boolean;
  /** Dismiss the prompt and leave the draft untouched. */
  onKeepEditing: () => void;
  /** Proceed, abandoning the draft. */
  onDiscard: () => void;
  /**
   * What the draft is, for the title: "Discard {noun}?". Keep it a bare noun —
   * "reply", "comment" — since the wording around it is fixed.
   */
  noun?: string;
  /**
   * How the draft is about to be lost. The default covers the common case (a
   * Cancel button on the editor itself); the navigation guard passes its own,
   * because there the draft is lost by leaving rather than by discarding.
   */
  message?: string;
  /**
   * Overrides the panel's `data-testid`, default `discard-draft-modal`. Pass one
   * when a screen can show two of these at once and a test has to say which.
   */
  testId?: string;
}

/**
 * Confirmation shown when an unsaved draft in a comment/reply editor is about to
 * be destroyed — by hitting Cancel, by closing the thread it lives in, or by
 * navigating away.
 *
 * All three are the same question, and before this they were three separate
 * dialogs with drifting wording ("Discard reply?" / "Discard unsaved reply?" /
 * "Leave page?") and three implementations — one hand-rolled portal, one
 * `ui/Modal`, one `ConfirmModal`. Sharing one component keeps them answering in
 * the same words, the way `ConfirmDiscardEdits` does for the character sheet.
 *
 * Distinct from `ConfirmDiscardEdits`, which is an inline bar for closing a
 * container that has a child editor open ("Close without saving"). This is a
 * modal about the draft text itself.
 */
export function ConfirmDiscardDraft({
  isOpen,
  onKeepEditing,
  onDiscard,
  noun = 'draft',
  message = `You have unsaved text in this ${noun}. If you discard it, your changes will be lost.`,
  testId = 'discard-draft-modal',
}: ConfirmDiscardDraftProps) {
  return (
    <ConfirmModal
      isOpen={isOpen}
      onClose={onKeepEditing}
      onConfirm={onDiscard}
      title={`Discard ${noun}?`}
      message={message}
      confirmText="Discard"
      cancelText="Keep editing"
      variant="danger"
      testId={testId}
    />
  );
}
