import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { Badge, Button } from '@/components/ui';
import { MarkdownPreview } from '@/components/common/markdown/MarkdownPreview';
import type { SheetItem } from '@/hooks/useCharacterSheetItems';
import {
  cardAt,
  cardedSpans,
  cardShades,
  findMatches,
  findSheetMatches,
  flatIndexAt,
  flattenText,
  paragraphCardCounts,
  submissionBlocks,
  type CardedSpan,
  type NamedCharacter,
  type SheetMatch,
} from '@/lib/gmBoard/read';
import type { Card, CodexEntry } from '@/lib/gmBoard/types';

export interface NewCardRequest {
  text: string;
  /** The paragraphs the text came from (a card's `src`). */
  paragraphs: number[];
  isIF: boolean;
}

interface SubmissionReaderProps {
  ownerId: number;
  text: string;
  /** Every card on the board; the owner's are picked out. */
  cards: Card[];
  /** Characters whose names are highlighted (the owner's own aren't). */
  characters: NamedCharacter[];
  /** This phase's codex entries, highlighted where they're named. */
  codex: CodexEntry[];
  /** The owner's sheet entries: `[[ref]]` tooltips, and entries the text names, underlined with their details on hover. */
  sheetItems?: SheetItem[];
  readOnly?: boolean;
  /** Each action shows only when its handler is given: Read cards and adds to the codex, Scenes starts moments. */
  onAddCard?: (request: NewCardRequest) => void;
  onAddCodex?: (text: string) => void;
  onAddMoment?: (text: string) => void;
  /** + Award: a reward for the owner, keeping the passage as its reason. */
  onAddAward?: (text: string) => void;
  onOpenCard: (cardId: string) => void;
}

interface Selected {
  text: string;
  paragraphs: number[];
  top: number;
  left: number;
}

const HIGHLIGHTS = ['gm-carded', 'gm-carded-alt', 'gm-name', 'gm-codex', 'gm-codex-location', 'gm-codex-secret', 'gm-sheet'] as const;

/** A sheet entry's details, shown below a match on hover or pinned open from "On the sheet". */
interface SheetTip {
  itemId: string;
  top: number;
  left: number;
  pinned: boolean;
}

const NO_ITEMS: SheetItem[] = [];

type HighlightRegistry = { set: (name: string, h: unknown) => void; delete: (name: string) => void };
type HighlightCtor = new (...ranges: Range[]) => unknown;

/** The CSS Custom Highlight API, where the browser has it. */
function highlightApi(): { registry: HighlightRegistry; Highlight: HighlightCtor } | null {
  const registry = (globalThis.CSS as unknown as { highlights?: HighlightRegistry } | undefined)?.highlights;
  const Highlight = (globalThis as unknown as { Highlight?: HighlightCtor }).Highlight;
  return registry && Highlight ? { registry, Highlight } : null;
}

/** The text nodes of the rendered submission, leaving out the board's own buttons and counts. */
function textNodes(root: HTMLElement): Text[] {
  const nodes: Text[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (n.parentElement?.closest('[data-gm-skip]') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);
  return nodes;
}

/** The paragraph index of the block holding a DOM node, if any. */
function blockOf(node: Node | null): number | null {
  const el = node && (node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement);
  const block = el?.closest('[data-block]');
  return block ? Number(block.getAttribute('data-block')) : null;
}

/**
 * One player's submission, paragraph by paragraph, for carding. Select text
 * for + Card, + IF card or + Codex; hover a paragraph to card all of it.
 * Text already on a card is highlighted, and clicking it opens the card;
 * names, codex terms and entries on the owner's sheet are highlighted too
 * (hover one for the entry; "On the sheet" lists them). Touching cards
 * alternate shades, and the card under the pointer is outlined. The
 * highlights are painted with
 * the CSS Custom Highlight API, so the rendered markdown is never rewritten;
 * without the API, each paragraph's card count still shows.
 */
export function SubmissionReader({
  ownerId,
  text,
  cards,
  characters,
  codex,
  sheetItems = NO_ITEMS,
  readOnly = false,
  onAddCard,
  onAddCodex,
  onAddMoment,
  onAddAward,
  onOpenCard,
}: SubmissionReaderProps) {
  const box = useRef<HTMLDivElement>(null);
  const painted = useRef<{ nodes: Text[]; map: [number, number][]; spans: CardedSpan[]; sheet: SheetMatch[] }>({ nodes: [], map: [], spans: [], sheet: [] });
  const [selected, setSelected] = useState<Selected | null>(null);
  const [hoverCard, setHoverCard] = useState<string | null>(null);
  const [tip, setTip] = useState<SheetTip | null>(null);

  const blocks = useMemo(() => submissionBlocks(text), [text]);
  const counts = useMemo(() => paragraphCardCounts(blocks, cards, ownerId), [blocks, cards, ownerId]);
  const others = useMemo(() => characters.filter((c) => c.id !== ownerId), [characters, ownerId]);
  const named = useMemo(() => {
    const ids = new Set(findSheetMatches(blocks.map((b) => b.text).join('\n'), sheetItems).map((m) => m.itemId));
    return sheetItems.filter((it) => ids.has(it.id));
  }, [blocks, sheetItems]);
  const tipItem = tip ? sheetItems.find((it) => it.id === tip.itemId) : undefined;

  // Paint the highlights after every render that could move them.
  useEffect(() => {
    const root = box.current;
    if (!root) return;
    const nodes = textNodes(root);
    const { flat, map } = flattenText(nodes.map((n) => n.nodeValue ?? ''));
    const spans = cardedSpans(flat, cards, ownerId);
    const sheet = findSheetMatches(flat, sheetItems);
    painted.current = { nodes, map, spans, sheet };

    const api = highlightApi();
    if (!api) return;
    const toRange = (start: number, end: number) => rangeOf({ nodes, map }, start, end);
    const groups: Record<(typeof HIGHLIGHTS)[number], Range[]> = {
      'gm-carded': [], 'gm-carded-alt': [], 'gm-name': [], 'gm-codex': [], 'gm-codex-location': [], 'gm-codex-secret': [], 'gm-sheet': [],
    };
    const shades = cardShades(spans);
    for (const [name, list] of [['gm-carded', shades.even], ['gm-carded-alt', shades.odd]] as const) {
      for (const s of list) {
        const r = toRange(s.start, s.end);
        if (r) groups[name].push(r);
      }
    }
    for (const m of sheet) {
      const r = toRange(m.start, m.end);
      if (r) groups['gm-sheet'].push(r);
    }
    const byId = new Map(codex.map((e) => [e.id, e]));
    for (const m of findMatches(flat, others, codex)) {
      const r = toRange(m.start, m.end);
      if (!r) continue;
      if (m.tag.kind === 'name') groups['gm-name'].push(r);
      else {
        const e = byId.get(m.tag.entryId);
        groups[e?.secret || e?.type === 'Secret' ? 'gm-codex-secret' : e?.type === 'Location' ? 'gm-codex-location' : 'gm-codex'].push(r);
      }
    }
    for (const name of HIGHLIGHTS) {
      if (groups[name].length) api.registry.set(name, new api.Highlight(...groups[name]));
      else api.registry.delete(name);
    }
  }, [blocks, cards, ownerId, others, codex, sheetItems]);

  // Outline the card under the pointer, so where one card ends and the next begins shows.
  useEffect(() => {
    const api = highlightApi();
    if (!api) return;
    const span = hoverCard ? painted.current.spans.find((s) => s.cardId === hoverCard) : undefined;
    const r = span && rangeOf(painted.current, span.start, span.end);
    if (r) api.registry.set('gm-carded-hover', new api.Highlight(r));
    else api.registry.delete('gm-carded-hover');
  }, [hoverCard, cards, blocks]);

  useEffect(
    () => () => {
      const api = highlightApi();
      if (api) for (const name of [...HIGHLIGHTS, 'gm-carded-hover']) api.registry.delete(name);
    },
    [],
  );

  // Show the selection toolbar for text selected inside the submission.
  const readSelection = useCallback(() => {
    if (readOnly) return;
    const sel = window.getSelection();
    const root = box.current;
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed || !root) return setSelected(null);
    if (!root.contains(sel.anchorNode) || !root.contains(sel.focusNode)) return setSelected(null);
    const picked = sel.toString().replace(/\s+/g, ' ').trim();
    if (picked.length < 3) return setSelected(null);
    const a = blockOf(sel.anchorNode);
    const b = blockOf(sel.focusNode);
    const from = Math.min(a ?? b ?? 0, b ?? a ?? 0);
    const to = Math.max(a ?? b ?? 0, b ?? a ?? 0);
    const paragraphs = a === null && b === null ? [] : Array.from({ length: to - from + 1 }, (_, i) => from + i);
    const range = sel.getRangeAt(0);
    const rect = typeof range.getBoundingClientRect === 'function' ? range.getBoundingClientRect() : null;
    setSelected({
      text: picked,
      paragraphs,
      top: Math.min(window.innerHeight - 48, (rect?.bottom ?? 0) + 8),
      left: Math.max(12, Math.min(window.innerWidth - 360, rect?.left ?? 0)),
    });
  }, [readOnly]);

  useEffect(() => {
    const clear = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) setSelected(null);
    };
    document.addEventListener('selectionchange', clear);
    return () => document.removeEventListener('selectionchange', clear);
  }, []);

  const fromSelection = (act: (s: Selected) => void) => {
    if (!selected) return;
    act(selected);
    window.getSelection()?.removeAllRanges();
    setSelected(null);
  };

  // A click (not a selection) on carded text opens its card.
  const openAt = (event: MouseEvent<HTMLDivElement>) => {
    if ((event.target as Element).closest('button, a, [data-gm-skip]')) return;
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed) return;
    const at = flatAt(painted.current, event.clientX, event.clientY);
    const id = at === null ? null : cardAt(painted.current.spans, at);
    if (id) onOpenCard(id);
  };

  // What's under the pointer: the card to outline, and a sheet entry's details.
  const hoverAt = (event: MouseEvent<HTMLDivElement>) => {
    const at = flatAt(painted.current, event.clientX, event.clientY);
    const card = at === null ? null : cardAt(painted.current.spans, at);
    if (card !== hoverCard) setHoverCard(card);
    if (tip?.pinned) return;
    const m = at === null ? undefined : painted.current.sheet.find((s) => at >= s.start && at < s.end);
    if (!m) {
      if (tip) setTip(null);
      return;
    }
    if (m.itemId === tip?.itemId) return;
    const rect = rangeOf(painted.current, m.start, m.end)?.getBoundingClientRect?.();
    if (rect) setTip({ itemId: m.itemId, ...tipAt(rect), pinned: false });
  };
  const leave = () => {
    setHoverCard(null);
    if (tip && !tip.pinned) setTip(null);
  };

  if (!blocks.length) {
    return <p className="text-content-secondary">This submission is empty.</p>;
  }

  return (
    <div className="relative">
      {named.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-1 pl-[5.5rem] text-xs text-content-tertiary" data-testid="submission-sheet-matches">
          <span>On the sheet:</span>
          {named.map((it) => {
            const open = !!tip?.pinned && tip.itemId === it.id;
            return (
              <Button
                key={it.id}
                type="button"
                size="sm"
                variant="secondary"
                className="!px-1.5 !py-0 text-xs"
                aria-expanded={open}
                title={`${it.tabLabel}: ${it.name}`}
                onClick={(e) => setTip(open ? null : { itemId: it.id, ...tipAt(e.currentTarget.getBoundingClientRect()), pinned: true })}
              >
                {it.name}
              </Button>
            );
          })}
        </div>
      )}
      <div ref={box} onMouseUp={readSelection} onKeyUp={readSelection} onClick={openAt} onMouseMove={hoverAt} onMouseLeave={leave} className="space-y-3" data-testid="submission-text">
        {blocks.map((b, i) => {
          if (b.index === null) {
            return (
              <div key={i} className="pl-[5.5rem]">
                {b.kind === 'hr' ? (
                  <hr className="my-4 border-theme-default" />
                ) : (
                  <MarkdownPreview content={b.source} sheetItemRefs={sheetItems} />
                )}
              </div>
            );
          }
          const index = b.index;
          const n = counts[index] ?? 0;
          // A gutter left of the text holds the card count and, on hover or
          // focus, the whole-paragraph buttons in its place, so nothing covers
          // the text and the buttons add no height.
          return (
            <div key={i} data-block={index} className="group flex gap-2" data-testid={`submission-block-${index}`}>
              <div data-gm-skip className="relative w-16 shrink-0 pt-2 text-right">
                {n > 0 && (
                  <span
                    className="group-hover:invisible group-focus-within:invisible"
                    title={`${n} card${n > 1 ? 's' : ''} from this paragraph`}
                  >
                    <Badge variant="success" size="sm">
                      {n}
                    </Badge>
                  </span>
                )}
                {!readOnly && (onAddCard || onAddMoment) && (
                  <span className="absolute right-0 top-1 flex gap-1">
                    {onAddCard && (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          className="!px-2 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
                          aria-label="+ Whole paragraph"
                          title="Card the whole paragraph. To card part of it, select the text instead."
                          onClick={() => onAddCard({ text: b.text, paragraphs: [index], isIF: false })}
                        >
                          +
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          className="!px-2 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
                          aria-label="+ as IF"
                          title="Card the whole paragraph as an IF card"
                          onClick={() => onAddCard({ text: b.text, paragraphs: [index], isIF: true })}
                        >
                          IF
                        </Button>
                      </>
                    )}
                    {onAddMoment && (
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        className="!px-2 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
                        aria-label="→ Moment from paragraph"
                        title="A new moment with this paragraph shown above it. To use part of it, select the text instead."
                        onClick={() => onAddMoment(b.text)}
                      >
                        →
                      </Button>
                    )}
                  </span>
                )}
              </div>
              <div className={`min-w-0 flex-1 border-l-4 pl-3 ${n ? 'border-semantic-success' : 'border-transparent'}`}>
                <MarkdownPreview content={b.source} sheetItemRefs={sheetItems} />
              </div>
            </div>
          );
        })}
      </div>

      {selected && (
        <div
          role="toolbar"
          aria-label="Selected text"
          className="fixed z-30 flex gap-1 rounded-lg border border-theme-default surface-raised p-1 shadow-lg"
          style={{ top: selected.top, left: selected.left }}
          onMouseDown={(e) => e.preventDefault()}
          data-testid="selection-toolbar"
        >
          {onAddMoment && (
            <Button type="button" size="sm" variant="primary" onClick={() => fromSelection((s) => onAddMoment(s.text))}>
              → Moment
            </Button>
          )}
          {onAddCard && (
            <>
              <Button type="button" size="sm" variant="primary" onClick={() => fromSelection((s) => onAddCard({ text: s.text, paragraphs: s.paragraphs, isIF: false }))}>
                + Card
              </Button>
              <Button type="button" size="sm" variant="secondary" onClick={() => fromSelection((s) => onAddCard({ text: s.text, paragraphs: s.paragraphs, isIF: true }))}>
                + IF card
              </Button>
            </>
          )}
          {onAddCodex && (
            <Button type="button" size="sm" variant="ghost" onClick={() => fromSelection((s) => onAddCodex(s.text.slice(0, 80)))}>
              + Codex
            </Button>
          )}
          {onAddAward && (
            <Button type="button" size="sm" variant="ghost" onClick={() => fromSelection((s) => onAddAward(s.text))}>
              + Award
            </Button>
          )}
        </div>
      )}

      {tip && tipItem && (
        <div
          role={tip.pinned ? 'dialog' : 'tooltip'}
          aria-label={tipItem.name}
          className={`fixed z-50 max-w-sm rounded-lg border border-semantic-warning surface-overlay px-3 py-2 text-sm shadow-lg ${tip.pinned ? '' : 'pointer-events-none'}`}
          style={{ top: tip.top, left: tip.left }}
          onKeyDown={(e) => e.key === 'Escape' && setTip(null)}
          data-testid="sheet-entry-tip"
        >
          <div className="flex items-center gap-1.5 pr-6">
            <span className="font-semibold text-content-primary">{tipItem.name}</span>
            <Badge variant="warning" size="sm">
              {tipItem.tabLabel}
            </Badge>
          </div>
          {tipItem.metadata && <div className="mt-0.5 text-xs text-content-tertiary">{tipItem.metadata}</div>}
          {tipItem.description && <p className="mt-1 max-h-48 overflow-y-auto whitespace-pre-wrap text-xs text-content-secondary">{tipItem.description}</p>}
          {tip.pinned && (
            <Button type="button" variant="ghost" size="sm" className="absolute right-1 top-1 !px-1 !py-0" aria-label="Close" autoFocus onClick={() => setTip(null)}>
              ×
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

type Painted = { nodes: Text[]; map: [number, number][] };

/** Where a sheet entry's details go: below `rect`, kept on screen. */
function tipAt(rect: { bottom: number; left: number }) {
  return { top: Math.min(rect.bottom + 4, window.innerHeight - 160), left: Math.max(8, Math.min(rect.left, window.innerWidth - 392)) };
}

/** A DOM range over flattened text offsets [start, end). */
function rangeOf({ nodes, map }: Painted, start: number, end: number): Range | null {
  const a = map[start];
  const z = map[Math.min(end - 1, map.length - 1)];
  if (!a || !z) return null;
  const range = document.createRange();
  range.setStart(nodes[a[0]], a[1]);
  range.setEnd(nodes[z[0]], Math.min(z[1] + 1, nodes[z[0]].length));
  return range;
}

/** The flattened-text offset under a point, if it's in the submission's text. */
function flatAt({ nodes, map }: Painted, x: number, y: number): number | null {
  const doc = document as Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
  };
  const pos = doc.caretPositionFromPoint?.(x, y);
  const range = pos ? null : doc.caretRangeFromPoint?.(x, y);
  const node = pos?.offsetNode ?? range?.startContainer;
  const offset = pos?.offset ?? range?.startOffset ?? 0;
  const part = node ? nodes.indexOf(node as Text) : -1;
  return part < 0 ? null : flatIndexAt(map, part, offset);
}
