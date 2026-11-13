import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { Button } from '@/components/ui';

export type SidePanelTab = 'codex' | 'notes';

const TITLES: Record<SidePanelTab, string> = { codex: 'Codex', notes: 'Notes' };

const WIDTH_KEY = 'gmBoard.sidePanelWidth';
const MIN_WIDTH = 360;
const DEFAULT_WIDTH = 560;
const STEP = 40;

/** Six tenths of the window at most, so the board keeps the rest. */
const maxWidth = () => Math.max(MIN_WIDTH, Math.round((typeof window === 'undefined' ? 1440 : window.innerWidth) * 0.6));
const clamp = (w: number) => Math.min(maxWidth(), Math.max(MIN_WIDTH, Math.round(w)));

/** The width this viewer last dragged it to (a per-browser convenience). */
function savedWidth(): number {
  try {
    const n = Number(window.localStorage.getItem(WIDTH_KEY));
    return Number.isFinite(n) && n > 0 ? clamp(n) : clamp(DEFAULT_WIDTH);
  } catch {
    return clamp(DEFAULT_WIDTH);
  }
}

function saveWidth(w: number) {
  try {
    window.localStorage.setItem(WIDTH_KEY, String(w));
  } catch {
    // Storage blocked: the width just isn't remembered.
  }
}

interface BoardSidePanelProps {
  /** Which is open; the board header's Codex and Notes buttons switch it. */
  tab: SidePanelTab;
  onClose: () => void;
  children: ReactNode;
}

/**
 * The codex and the notes, docked beside the open step rather than over it,
 * so the GM can read either while carding, writing a scene or a result. Drag
 * (or arrow-key) its left edge to resize; Escape closes it.
 */
export function BoardSidePanel({ tab, onClose, children }: BoardSidePanelProps) {
  const [width, setWidth] = useState(savedWidth);
  const drag = useRef<{ x: number; w: number } | null>(null);

  const commit = useCallback((w: number) => {
    const next = clamp(w);
    setWidth(next);
    saveWidth(next);
  }, []);

  useEffect(() => {
    const fit = () => setWidth((w) => clamp(w));
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    drag.current = { x: e.clientX, w: width };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (drag.current) setWidth(clamp(drag.current.w + (drag.current.x - e.clientX)));
  };
  const onPointerUp = () => {
    if (!drag.current) return;
    drag.current = null;
    commit(width);
  };
  const onHandleKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowLeft') commit(width + STEP);
    else if (e.key === 'ArrowRight') commit(width - STEP);
    else return;
    e.preventDefault();
  };

  const label = TITLES[tab];

  return (
    <aside
      aria-label={label}
      className="sticky top-20 flex h-[calc(100vh-6rem)] shrink-0 self-start rounded-lg border border-theme-strong surface-raised shadow-sm"
      style={{ width }}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && !e.defaultPrevented) {
          e.stopPropagation();
          onClose();
        }
      }}
      data-testid="board-side-panel"
    >
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize the panel"
        aria-valuemin={MIN_WIDTH}
        aria-valuemax={maxWidth()}
        aria-valuenow={width}
        tabIndex={0}
        className="w-1.5 shrink-0 cursor-col-resize rounded-l-lg hover:bg-interactive-primary/30 focus:bg-interactive-primary/30 focus:outline-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onHandleKey}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-1 border-b border-theme-default px-3 py-2">
          <h2 className="flex-1 text-base font-semibold text-content-primary">{label}</h2>
          <Button type="button" size="sm" variant="ghost" aria-label={`Close the ${label.toLowerCase()}`} onClick={onClose}>
            ✕
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
      </div>
    </aside>
  );
}
