import { useEffect } from 'react';
import { useBlocker } from 'react-router-dom';
import { ConfirmDiscardDraft } from '@/components/common/modals/ConfirmDiscardDraft';

interface UnsavedChangesGuardProps {
  /** Whether there is anything to lose. */
  when: boolean;
  /** What would be lost, for the title: "Discard {noun}?". */
  noun: string;
  message: string;
}

/**
 * Asks before leaving with unsaved work, in the app or by closing the page.
 *
 * Its own component so `useBlocker` only runs for editors that want it (hooks
 * can't be called conditionally). It asks the same question a Cancel button
 * does, so it shares that dialog; only the trigger differs.
 */
export function UnsavedChangesGuard({ when, noun, message }: UnsavedChangesGuardProps) {
  const blocker = useBlocker(when);

  useEffect(() => {
    if (!when) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [when]);

  return (
    <ConfirmDiscardDraft
      isOpen={blocker.state === 'blocked'}
      onKeepEditing={() => blocker.reset?.()}
      onDiscard={() => blocker.proceed?.()}
      noun={noun}
      message={message}
      testId="discard-navigation-modal"
    />
  );
}
