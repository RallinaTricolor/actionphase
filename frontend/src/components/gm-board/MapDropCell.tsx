import { useState, type ReactNode } from 'react';
import type { DragState, DropTarget } from './mapTypes';

interface MapDropCellProps {
  target: DropTarget;
  drag: DragState;
  onDrop: (cardId: string, target: DropTarget) => void;
  className?: string;
  title?: string;
  children: ReactNode;
  'data-testid'?: string;
}

/**
 * A cell a card can be dragged into (native HTML5 drag and drop). It only
 * takes drops while a board card is being dragged, and outlines itself while
 * one is over it. The card panel's pickers do the same without a mouse.
 */
export function MapDropCell({ target, drag, onDrop, className = '', title, children, 'data-testid': testId }: MapDropCellProps) {
  const [over, setOver] = useState(false);
  return (
    <div
      className={`group relative min-h-16 space-y-1 p-1.5 ${over ? 'outline outline-2 outline-offset-[-2px] outline-[rgb(var(--color-interactive-primary))]' : ''} ${className}`}
      title={title}
      data-testid={testId}
      onDragOver={(e) => {
        if (!drag.cardId) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (!over) setOver(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(false);
      }}
      onDrop={(e) => {
        setOver(false);
        const cardId = drag.cardId ?? e.dataTransfer.getData('text/plain');
        if (!cardId) return;
        e.preventDefault();
        drag.end();
        onDrop(cardId, target);
      }}
    >
      {children}
    </div>
  );
}
