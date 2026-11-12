import type { ReactNode } from 'react';
import { PANE_STICKY } from './boardToolbarSlot';

interface BoardPaneProps {
  /** Shown in the pane's title strip. A string is set as a small heading. */
  title?: ReactNode;
  /** Controls at the right of the title strip. */
  actions?: ReactNode;
  children: ReactNode;
  /** Stays in view while the page scrolls; its body scrolls on its own. */
  sticky?: boolean;
  bodyClassName?: string;
  className?: string;
  'aria-label'?: string;
  'data-testid'?: string;
}

/**
 * One area of a board step's workspace: a bordered card on the page, with a
 * sunken title strip. The strip is what tells the panes apart from each other
 * and from the header block above them, in light and dark themes alike (the
 * raised surface matches the page in the dark theme, so it can't be used).
 */
export function BoardPane({ title, actions, children, sticky, bodyClassName = '', className = '', 'aria-label': label, 'data-testid': testId }: BoardPaneProps) {
  return (
    <section
      aria-label={label}
      data-testid={testId}
      className={`flex min-w-0 flex-col rounded-lg border border-theme-default surface-base ${sticky ? PANE_STICKY : ''} ${className}`}
    >
      {(title || actions) && (
        <div className="flex min-h-[2.75rem] flex-wrap items-center gap-2 rounded-t-lg border-b border-theme-default surface-sunken px-3 py-1.5">
          {typeof title === 'string' ? <h3 className="text-xs font-semibold uppercase tracking-wide text-content-secondary">{title}</h3> : title}
          <span className="flex-1" />
          {actions}
        </div>
      )}
      <div className={`min-h-0 p-3 ${sticky ? 'overflow-y-auto' : ''} ${bodyClassName}`}>{children}</div>
    </section>
  );
}
