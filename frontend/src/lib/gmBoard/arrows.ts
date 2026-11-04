import type { Card } from './types';

/** How the Map draws causes: only for the card under the pointer (or open), for every card, or never. */
export type ArrowMode = 'hover' | 'all' | 'off';

export const ARROW_MODES: { value: ArrowMode; label: string }[] = [
  { value: 'hover', label: 'On hover' },
  { value: 'all', label: 'All' },
  { value: 'off', label: 'Off' },
];

export const isArrowMode = (v: unknown): v is ArrowMode => ARROW_MODES.some((m) => m.value === v);

/** One arrow: from a cause (a card or scene) to the card it caused. A branch arrow runs from a card to its alternative. */
export interface CauseLink {
  from: string;
  to: string;
  kind: 'cause' | 'branch';
}

/**
 * The arrows to draw. `hot` is the card or scene under the pointer, focused,
 * or open in the card panel. In hover mode only its own links show.
 */
export function causeLinks(cards: Card[], mode: ArrowMode, hot: string | null): CauseLink[] {
  if (mode === 'off' || (mode === 'hover' && !hot)) return [];
  const links: CauseLink[] = [];
  for (const c of cards) {
    for (const from of c.causedBy) if (from !== c.id) links.push({ from, to: c.id, kind: 'cause' });
    if (c.branchOf && c.branchOf !== c.id) links.push({ from: c.branchOf, to: c.id, kind: 'branch' });
  }
  return mode === 'hover' ? links.filter((l) => l.from === hot || l.to === hot) : links;
}

/** A box in the arrows layer's coordinates. */
export interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

const centerY = (b: Box) => (b.top + b.bottom) / 2;
const centerX = (b: Box) => (b.left + b.right) / 2;

/**
 * The SVG path for an arrow from box `a` to box `b`: side to side when the
 * boxes are in different columns, else bottom to top (or top to bottom)
 * near their right edges. A slight curve keeps arrows between the same rows
 * from lying on top of each other; a short, near-vertical one bends out more
 * so it doesn't run along the cards.
 */
export function arrowPath(a: Box, b: Box): string {
  let x1: number, y1: number, x2: number, y2: number;
  if (b.left > a.right) [x1, y1, x2, y2] = [a.right, centerY(a), b.left, centerY(b)];
  else if (a.left > b.right) [x1, y1, x2, y2] = [a.left, centerY(a), b.right, centerY(b)];
  else if (b.top > a.bottom) [x1, y1, x2, y2] = [a.right - 12, a.bottom, b.right - 12, b.top];
  else [x1, y1, x2, y2] = [a.right - 12, a.top, b.right - 12, b.bottom];
  const dx = x2 - x1;
  const dy = y2 - y1;
  const bend = Math.abs(dx) < 30 ? 40 : 0;
  const cx = (x1 + x2) / 2 - dy * 0.18 + bend;
  const cy = (y1 + y2) / 2 + dx * 0.18;
  const f = (n: number) => n.toFixed(1);
  return `M${f(x1)} ${f(y1)} Q${f(cx)} ${f(cy)} ${f(x2)} ${f(y2)}`;
}

/**
 * The closest pair of boxes, one from each list. A scene shows in several
 * cells on the Map by character (one per person in it), so an arrow from it
 * starts at the copy nearest the card it caused.
 */
export function nearestPair(from: Box[], to: Box[]): [Box, Box] | null {
  let best: [Box, Box] | null = null;
  let bestD = Infinity;
  for (const a of from) {
    for (const b of to) {
      const d = Math.hypot(centerX(a) - centerX(b), centerY(a) - centerY(b));
      if (d < bestD) [best, bestD] = [[a, b], d];
    }
  }
  return best;
}
