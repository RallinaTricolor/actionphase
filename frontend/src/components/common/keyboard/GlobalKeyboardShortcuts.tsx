import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui';
import { useToast } from '@/contexts/ToastContext';
import {
  HELP_KEY,
  UNREAD_KEY,
  SHORTCUT_GROUPS,
  isEditableTarget,
  jumpToUnread,
} from '@/lib/keyboardShortcuts';
import { ShortcutKeys } from './ShortcutKeys';

/**
 * Page-level single-key shortcuts: `?` opens the cheat sheet, `n` / Shift+`n`
 * jump to the next / previous unread item.
 *
 * Single keys are only safe where keystrokes don't type, so they stand aside
 * when focus is in a text field, inside an open dialog or drawer (which owns
 * the keyboard), or when a modifier is held (leaving browser and OS combos alone).
 */
export function GlobalKeyboardShortcuts() {
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const { showInfo } = useToast();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.isComposing || e.ctrlKey || e.metaKey || e.altKey) return;
      if (isEditableTarget(e.target)) return;
      if (e.target instanceof Element && e.target.closest('[role="dialog"]')) return;

      if (e.key === HELP_KEY) {
        e.preventDefault();
        setIsHelpOpen(true);
      } else if (e.key.toLowerCase() === UNREAD_KEY) {
        // Direction comes from Shift, not the letter's case, so Caps Lock
        // doesn't turn a plain `n` into "previous".
        e.preventDefault();
        if (!jumpToUnread(e.shiftKey ? 'previous' : 'next')) showInfo('Nothing unread on this page');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showInfo]);

  return (
    <Modal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} title="Keyboard shortcuts" size="lg">
      <div className="space-y-5" data-testid="keyboard-shortcuts-help">
        {SHORTCUT_GROUPS.map((group) => (
          <section key={group.id}>
            <h3 className="text-sm font-semibold text-content-secondary mb-2">{group.title}</h3>
            <dl className="divide-y divide-theme-default">
              {group.shortcuts.map(({ keys, description }) => (
                <div key={description} className="flex items-center justify-between gap-4 py-1.5 text-sm">
                  <dt className="text-content-primary">{description}</dt>
                  <dd>
                    <ShortcutKeys keys={keys} />
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </Modal>
  );
}
