import { useContext, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { BoardToolbarSlotContext } from './boardToolbarSlot';

interface BoardToolbarProps {
  children: ReactNode;
  'aria-label': string;
  'data-testid'?: string;
}

/**
 * A step's own controls (who or which scene it shows, its views and actions),
 * drawn in the board's header block under the step tabs, so the header reads
 * as one unit and the step's workspace starts below it. Rows inside are
 * separated with `TOOLBAR_ROW`.
 */
export function BoardToolbar({ children, 'aria-label': label, 'data-testid': testId }: BoardToolbarProps) {
  const slot = useContext(BoardToolbarSlotContext);
  const bar = (
    <div role="group" aria-label={label} className="space-y-2" data-testid={testId}>
      {children}
    </div>
  );
  if (slot === undefined) return <div className="rounded-lg border border-theme-default surface-sunken px-4 py-2">{bar}</div>;
  if (slot === null) return null;
  return createPortal(bar, slot);
}

