import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { Button, Select } from '@/components/ui';
import type { SheetItem } from '@/hooks/useCharacterSheetItems';
import type { DraftTarget } from '@/hooks/useResultDraft';
import { targetPart, type ResultChain } from '@/lib/gmBoard/results';
import { DEFAULT_DELAY_MINUTES, DELAY_PRESETS, formatDelayLabel } from '@/lib/stagedDelays';
import type { ActionResult } from '@/types/phases';
import { ResultChainCard } from './ResultChainCard';
import { ResultPartEditor } from './ResultPartEditor';

interface WriteResultsProps {
  gameId: number;
  characterId: number;
  /** Full name, for dialogs. */
  characterName: string;
  /** Short name, for prompts. */
  name: string;
  /** Who gets their results; undefined when nobody plays them. */
  userId?: number;
  /** Their submission this phase, which their first result answers. */
  submissionId?: number;
  chains: ResultChain[];
  phaseResults: ActionResult[];
  /** The part the GM last picked for this character (kept across steps). */
  selectedPartId: number | null;
  onSelectPart: (partId: number | null) => void;
  /** The editor's text as typed, and the part it belongs to (null: not made yet). */
  onLiveText: (partId: number | null, text: string) => void;
  /** Whether there's a draft to type into, for the brief's Insert. */
  onEditable: (editable: boolean) => void;
  insertTextRef: MutableRefObject<((text: string) => void) | null>;
  transformTextRef: MutableRefObject<((fn: (text: string) => string) => void) | null>;
  flushRef: MutableRefObject<(() => Promise<void>) | null>;
  sheetItems?: SheetItem[];
}

type Pending = { kind: 'new-result'; key: string } | { kind: 'new-part'; key: string; tailId: number; delayMinutes: number };

/**
 * A character's results this phase, each with its parts, and the draft the
 * GM is typing into. With no result yet, the editor is already there: the
 * first keystroke makes their first result, linked to their submission.
 */
export function WriteResults(props: WriteResultsProps) {
  const { gameId, characterId, characterName, name, userId, submissionId, chains, phaseResults, selectedPartId, onSelectPart } = props;
  const [pending, setPending] = useState<Pending | null>(null);
  // Rows made here that the results list hasn't caught up with yet.
  const [created, setCreated] = useState<ActionResult[]>([]);
  // A made row keeps the React key its placeholder had, so the editor stays
  // mounted (and keeps what's typed) as the target switches to it.
  const keys = useRef(new Map<number, string>());

  const listed = useMemo(() => new Set(chains.flatMap((c) => c.parts.map((p) => p.id))), [chains]);
  useEffect(() => {
    if (created.some((r) => listed.has(r.id))) setCreated((list) => list.filter((r) => !listed.has(r.id)));
  }, [created, listed]);

  const merged = useMemo(() => {
    let out = chains.map((c) => ({ ...c, parts: [...c.parts] }));
    for (const r of created) {
      if (listed.has(r.id)) continue;
      const owner = r.parent_result_id !== undefined ? out.find((c) => c.parts.some((p) => p.id === r.parent_result_id)) : undefined;
      if (owner) owner.parts.push(r);
      else out = [...out, { head: r, parts: [r] }];
    }
    return out;
  }, [chains, created, listed]);

  const part = pending ? null : targetPart(merged, selectedPartId);
  const firstKey = `new:first:${characterId}`;
  const implicitNew = !pending && !part && merged.length === 0 && userId !== undefined;
  const editable = !!pending || !!part || implicitNew;
  const { onEditable, onLiveText } = props;
  useEffect(() => onEditable(editable), [editable, onEditable]);

  const onCreated = useCallback(
    (key: string) => (r: ActionResult) => {
      keys.current.set(r.id, key);
      setCreated((list) => [...list, { ...r, character_id: characterId }]);
      setPending(null);
      onSelectPart(r.id);
    },
    [characterId, onSelectPart],
  );

  const editor = (key: string, target: DraftTarget, id: number | null, label: string) => (
    <ResultPartEditor
      key={key}
      gameId={gameId}
      target={target}
      onCreated={onCreated(key)}
      onText={(text) => onLiveText(id, text)}
      insertTextRef={props.insertTextRef}
      transformTextRef={props.transformTextRef}
      flushRef={props.flushRef}
      sheetItems={props.sheetItems}
      label={label}
      placeholder={`Write ${name}’s result in your own words. Insert puts a moment at the cursor.`}
    />
  );

  const flush = () => props.flushRef.current?.() ?? Promise.resolve();
  const select = async (id: number) => {
    await flush();
    setPending(null);
    onSelectPart(id);
  };
  const startPending = async (p: Pending) => {
    await flush();
    setPending(p);
  };

  if (userId === undefined && merged.length === 0) {
    return <p className="text-sm text-content-secondary">Nobody plays {name}, so there’s no one to send a result to.</p>;
  }

  // The one editor, always in the same place after the list, so React keeps
  // it (and the cursor, and what's typed) as a new result or part is made.
  const chainOf = (id: number) => merged.findIndex((c) => c.parts.some((p) => p.id === id));
  let slot: { key: string; target: DraftTarget; id: number | null; label: string } | null = null;
  if (pending?.kind === 'new-part') {
    const i = chainOf(pending.tailId);
    const tail = i >= 0 ? merged[i].parts[merged[i].parts.length - 1] : null;
    if (tail) slot = { key: pending.key, target: { kind: 'new-part', tail, delayMinutes: pending.delayMinutes }, id: null, label: `Result ${i + 1}, new part ${merged[i].parts.length + 1}` };
  } else if (pending?.kind === 'new-result' || implicitNew) {
    slot = {
      key: pending?.key ?? firstKey,
      // Only the first result answers the submission.
      target: { kind: 'new-result', userId: userId as number, characterId, submissionId: merged.length === 0 ? submissionId : undefined },
      id: null,
      label: `Result ${merged.length + 1}`,
    };
  } else if (part) {
    const i = chainOf(part.id);
    const parts = merged[i]?.parts ?? [part];
    slot = { key: keys.current.get(part.id) ?? `part:${part.id}`, target: { kind: 'part', part }, id: part.id, label: parts.length > 1 ? `Result ${i + 1}, part ${parts.indexOf(part) + 1}` : `Result ${i + 1}` };
  }

  return (
    <div className="space-y-3" data-testid="write-results">
      {merged.map((chain, i) => (
        <ResultChainCard
          key={chain.head.id}
          gameId={gameId}
          chain={chain}
          label={`Result ${i + 1}`}
          characterId={characterId}
          characterName={characterName}
          phaseResults={phaseResults}
          selectedId={part?.id ?? null}
          onSelect={(id) => void select(id)}
          addingPart={pending?.kind === 'new-part' && chain.parts.some((p) => p.id === pending.tailId)}
          onAddPart={(tail) => void startPending({ kind: 'new-part', key: `new:part:${tail.id}:${Date.now()}`, tailId: tail.id, delayMinutes: DEFAULT_DELAY_MINUTES })}
          flush={flush}
          onDeleted={(c) => {
            if (c.parts.some((p) => p.id === selectedPartId)) onSelectPart(null);
          }}
        />
      ))}

      {slot && (
        <div key="draft-slot" className="space-y-2 rounded-lg border border-theme-default p-3" data-testid="draft-slot">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <h4 className="text-sm font-semibold text-content-primary">
              {slot.id === null ? 'New: ' : 'Editing: '}
              {slot.label}
            </h4>
            <div className="flex flex-wrap items-end gap-2">
              {pending?.kind === 'new-part' && (
                <Select
                  label="Revealed this long after the part before"
                  selectSize="sm"
                  value={String(pending.delayMinutes)}
                  onChange={(e) => setPending({ ...pending, delayMinutes: Number(e.target.value) })}
                  data-testid="new-part-delay"
                >
                  {DELAY_PRESETS.map((m) => (
                    <option key={m} value={m}>
                      {formatDelayLabel(m)}
                    </option>
                  ))}
                </Select>
              )}
              {pending && (
                <Button type="button" size="sm" variant="ghost" onClick={() => setPending(null)}>
                  Cancel
                </Button>
              )}
            </div>
          </div>
          {editor(slot.key, slot.target, slot.id, slot.label)}
          {pending?.kind === 'new-part' && <p className="text-xs text-content-tertiary">It’s saved once you type. Each timer starts when the part before it is revealed.</p>}
        </div>
      )}

      {!editable && merged.length > 0 && <p className="text-sm text-content-secondary">Every result for {name} is published.</p>}

      {merged.length > 0 && pending?.kind !== 'new-result' && userId !== undefined && (
        <Button type="button" size="sm" variant="secondary" onClick={() => void startPending({ kind: 'new-result', key: `new:result:${Date.now()}` })}>
          + Another result
        </Button>
      )}
    </div>
  );
}
