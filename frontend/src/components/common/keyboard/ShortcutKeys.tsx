import { Fragment } from 'react';
import { keyLabel } from '@/lib/keyboardShortcuts';

/** Renders a key combo from `SHORTCUT_GROUPS` as <kbd> chips, e.g. ⌘ + Enter. */
export function ShortcutKeys({ keys }: { keys: string[] }) {
  return (
    <span className="whitespace-nowrap">
      {keys.map((key, index) => (
        <Fragment key={key}>
          {index > 0 && <span className="text-content-tertiary"> + </span>}
          <kbd className="surface-sunken border border-theme-default rounded px-1 font-mono text-xs">{keyLabel(key)}</kbd>
        </Fragment>
      ))}
    </span>
  );
}
