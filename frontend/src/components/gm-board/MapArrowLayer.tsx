import { useLayoutEffect, useMemo, useRef, useState, useId, type FocusEvent, type MouseEvent, type ReactNode } from 'react';
import { arrowPath, causeLinks, nearestPair, type ArrowMode, type Box, type CauseLink } from '@/lib/gmBoard/arrows';
import type { Card } from '@/lib/gmBoard/types';

/** What a Map view needs to draw causes: the mode and the card open in the panel. */
export interface MapArrows {
  mode: ArrowMode;
  openId: string | null;
}

interface MapArrowLayerProps {
  cards: Card[];
  arrows: MapArrows | undefined;
  /** Re-measures when this changes (the board's model, the view). */
  layoutKey: unknown;
  children: ReactNode;
}

interface Drawn {
  key: string;
  d: string;
  kind: CauseLink['kind'];
  hot: boolean;
}

const ARROW_SELECTOR = '[data-arrow-id]';

/**
 * Draws causes between cards (and from scenes) over a Map grid. Cards and
 * scenes mark themselves with `data-arrow-id`. The card under the pointer,
 * else the focused one, else the one open in the panel, is "hot": on hover only its arrows show, and
 * in All its arrows are drawn stronger. The causes are also listed in the
 * card panel ("Because of…"), so the arrows are decoration for sighted
 * users, hidden from screen readers.
 *
 * Hover state lives here, not in the Map, so moving the pointer redraws the
 * arrows without re-rendering the grid.
 */
export function MapArrowLayer({ cards, arrows, layoutKey, children }: MapArrowLayerProps) {
  const ref = useRef<HTMLDivElement>(null);
  // Pointer and keyboard focus are tracked apart, so the pointer resting on a
  // cell doesn't cancel the card a keyboard user has focused.
  const [hover, setHover] = useState<string | null>(null);
  const [focused, setFocused] = useState<string | null>(null);
  const [size, setSize] = useState(0);
  const [drawn, setDrawn] = useState<{ paths: Drawn[]; ends: Box[] }>({ paths: [], ends: [] });
  const markerId = useId().replace(/:/g, '');
  const mode = arrows?.mode ?? 'off';
  const hot = hover ?? focused ?? arrows?.openId ?? null;
  const links = useMemo(() => causeLinks(cards, mode, hot), [cards, mode, hot]);

  // Cells change size as cards move, wrap, or the window resizes.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || mode === 'off' || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setSize((n) => n + 1));
    ro.observe(el);
    return () => ro.disconnect();
  }, [mode]);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !links.length) {
      setDrawn((cur) => (cur.paths.length || cur.ends.length ? { paths: [], ends: [] } : cur));
      return;
    }
    const origin = el.getBoundingClientRect();
    const boxes = new Map<string, Box[]>();
    el.querySelectorAll<HTMLElement>(ARROW_SELECTOR).forEach((node) => {
      const id = node.dataset.arrowId;
      if (!id) return;
      const r = node.getBoundingClientRect();
      const box = { left: r.left - origin.left, top: r.top - origin.top, right: r.right - origin.left, bottom: r.bottom - origin.top };
      boxes.set(id, [...(boxes.get(id) ?? []), box]);
    });
    const paths: Drawn[] = [];
    const ends: Box[] = [];
    for (const l of links) {
      const pair = nearestPair(boxes.get(l.from) ?? [], boxes.get(l.to) ?? []);
      if (!pair) continue;
      const isHot = !!hot && (l.from === hot || l.to === hot);
      paths.push({ key: `${l.kind}|${l.from}|${l.to}`, d: arrowPath(pair[0], pair[1]), kind: l.kind, hot: isHot });
      if (isHot) ends.push(...pair);
    }
    setDrawn({ paths, ends });
  }, [links, hot, layoutKey, size]);

  const pick = (target: EventTarget | null) => {
    const node = target instanceof Element ? target.closest<HTMLElement>(ARROW_SELECTOR) : null;
    return node && ref.current?.contains(node) ? (node.dataset.arrowId ?? null) : null;
  };
  const live = mode !== 'off';

  return (
    <div
      ref={ref}
      className="relative"
      onMouseOver={live ? (e: MouseEvent) => setHover(pick(e.target)) : undefined}
      onMouseLeave={live ? () => setHover(null) : undefined}
      onFocus={live ? (e: FocusEvent) => setFocused(pick(e.target)) : undefined}
      onBlur={live ? (e: FocusEvent) => setFocused(pick(e.relatedTarget)) : undefined}
    >
      {children}
      {live && drawn.paths.length > 0 && (
        <svg className="pointer-events-none absolute inset-0 z-[5] h-full w-full overflow-visible" aria-hidden="true" data-testid="map-arrows">
          <defs>
            {(['cause', 'branch'] as const).map((k) => (
              <marker key={k} id={`${markerId}-${k}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path className={`gm-arrow-head-${k}`} d="M0 1 L10 5 L0 9 z" />
              </marker>
            ))}
          </defs>
          {drawn.ends.map((b, i) => (
            <rect key={i} className="gm-arrow-end" x={b.left - 2} y={b.top - 2} width={b.right - b.left + 4} height={b.bottom - b.top + 4} rx={6} />
          ))}
          {drawn.paths.map((p) => (
            <path
              key={p.key}
              className={`gm-arrow gm-arrow-${p.kind}${mode === 'all' && hot && !p.hot ? ' gm-arrow-faint' : ''}`}
              d={p.d}
              markerEnd={`url(#${markerId}-${p.kind})`}
              data-testid={`map-arrow-${p.kind}`}
            />
          ))}
        </svg>
      )}
    </div>
  );
}
