import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { Badge, Button } from '@/components/ui';
import { MarkdownPreview } from '@/components/common/markdown/MarkdownPreview';
import type { SheetItem } from '@/hooks/useCharacterSheetItems';
import {
  cardAt,
  cardedSpans,
  findMatches,
  flatIndexAt,
  flattenText,
  paragraphCardCounts,
  submissionBlocks,
  type CardedSpan,
  type NamedCharacter,
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
  /** The owner's sheet entries, for `[[ref]]` tooltips. */
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

const HIGHLIGHTS = ['gm-carded', 'gm-name', 'gm-codex', 'gm-codex-location', 'gm-codex-secret'] as const;

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
 * names and codex terms are highlighted too. The highlights are painted with
 * the CSS Custom Highlight API, so the rendered markdown is never rewritten;
 * without the API, each paragraph's card count still shows.
 */
export function SubmissionReader({
  ownerId,
  text,
  cards,
  characters,
  codex,
  sheetItems,
  readOnly = false,
  onAddCard,
  onAddCodex,
  onAddMoment,
  onAddAward,
  onOpenCard,
}: SubmissionReaderProps) {
  const box = useRef<HTMLDivElement>(null);
  const painted = useRef<{ nodes: Text[]; map: [number, number][]; spans: CardedSpan[] }>({ nodes: [], map: [], spans: [] });
  const [selected, setSelected] = useState<Selected | null>(null);

  const blocks = useMemo(() => submissionBlocks(text), [text]);
  const counts = useMemo(() => paragraphCardCounts(blocks, cards, ownerId), [blocks, cards, ownerId]);
  const others = useMemo(() => characters.filter((c) => c.id !== ownerId), [characters, ownerId]);

  // Paint the highlights after every render that could move them.
  useEffect(() => {
    const root = box.current;
    if (!root) return;
    const nodes = textNodes(root);
    const { flat, map } = flattenText(nodes.map((n) => n.nodeValue ?? ''));
    const spans = cardedSpans(flat, cards, ownerId);
    painted.current = { nodes, map, spans };

    const api = highlightApi();
    if (!api) return;
    const toRange = (start: number, end: number) => {
      const a = map[start];
      const z = map[Math.min(end - 1, map.length - 1)];
      if (!a || !z) return null;
      const range = document.createRange();
      range.setStart(nodes[a[0]], a[1]);
      range.setEnd(nodes[z[0]], Math.min(z[1] + 1, nodes[z[0]].length));
      return range;
    };
    const groups: Record<(typeof HIGHLIGHTS)[number], Range[]> = {
      'gm-carded': [], 'gm-name': [], 'gm-codex': [], 'gm-codex-location': [], 'gm-codex-secret': [],
    };
    for (const s of spans) {
      const r = toRange(s.start, s.end);
      if (r) groups['gm-carded'].push(r);
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

  useEffect(
    () => () => {
      const api = highlightApi();
      if (api) for (const name of HIGHLIGHTS) api.registry.delete(name);
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
    const doc = document as Document & {
      caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
      caretRangeFromPoint?: (x: number, y: number) => Range | null;
    };
    const pos = doc.caretPositionFromPoint?.(event.clientX, event.clientY);
    const range = pos ? null : doc.caretRangeFromPoint?.(event.clientX, event.clientY);
    const node = pos?.offsetNode ?? range?.startContainer;
    const offset = pos?.offset ?? range?.startOffset ?? 0;
    const { nodes, map, spans } = painted.current;
    const part = node ? nodes.indexOf(node as Text) : -1;
    if (part < 0) return;
    const id = cardAt(spans, flatIndexAt(map, part, offset));
    if (id) onOpenCard(id);
  };

  if (!blocks.length) {
    return <p className="text-content-secondary">This submission is empty.</p>;
  }

  return (
    <div className="relative">
      <div ref={box} onMouseUp={readSelection} onKeyUp={readSelection} onClick={openAt} className="space-y-3" data-testid="submission-text">
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
    </div>
  );
}
