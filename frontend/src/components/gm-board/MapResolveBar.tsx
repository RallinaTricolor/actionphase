import { useMemo } from 'react';
import { Badge, Button } from '@/components/ui';
import { boardLabel, isWaiting } from '@/lib/gmBoard/cards';
import { shortName } from '@/lib/gmBoard/text';
import { cellContents, flagCardId, flagSentence, presentIn } from './mapModel';
import type { MapActions, MapModel } from './mapTypes';

interface MapResolveBarProps {
  model: MapModel;
  chunkId: string;
  actions: MapActions;
  onClose: () => void;
}

/**
 * Resolve mode: one time slot at a time. Lists the slot's busy cells, its
 * open checks, and the IF cards waiting for someone who is there, which
 * "here ▸" triggers in this slot. The other slots dim.
 */
export function MapResolveBar({ model, chunkId, actions, onClose }: MapResolveBarProps) {
  const index = model.slots.findIndex((s) => s.id === chunkId);
  const slot = model.slots[index];
  const cells = useMemo(() => cellContents(model), [model]);

  const busy = model.rows
    .map((row) => ({ row, cell: cells.get(`${row.id}|${chunkId}`) }))
    .map(({ row, cell }) => ({ row, cell, present: presentIn(cell) }))
    .filter((x) => x.present.length >= 2);
  const here = new Set(model.rows.flatMap((r) => presentIn(cells.get(`${r.id}|${chunkId}`))));
  const waiting = model.board.cards.filter((c) => isWaiting(c) && here.has(c.characterId));
  const flags = model.open.filter((f) => f.chunkId === chunkId);
  const todo = (id: string) => model.open.filter((f) => f.chunkId === id).length;
  const name = (id: number) => shortName(model.names.get(id) ?? '?');

  if (!slot) return null;
  return (
    <section aria-label={`Resolving ${slot.name}`} className="space-y-2 rounded-lg border border-interactive-primary surface-raised p-3" data-testid="resolve-bar">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-semibold text-content-primary">Resolving {slot.name}</h3>
        <span className="flex-1" />
        <Button type="button" variant="secondary" size="sm" disabled={index <= 0} onClick={() => actions.resolveAt(model.slots[index - 1].id)}>
          ← Previous
        </Button>
        <div className="flex flex-wrap gap-1" role="group" aria-label="Time slots">
          {model.slots.map((s) => (
            <Button
              key={s.id}
              type="button"
              size="sm"
              variant={s.id === chunkId ? 'primary' : 'ghost'}
              aria-pressed={s.id === chunkId}
              onClick={() => actions.resolveAt(s.id)}
              title={todo(s.id) ? `${todo(s.id)} to do` : 'Nothing to do'}
            >
              {s.name}
              {todo(s.id) > 0 ? ` · ${todo(s.id)}` : ' ✓'}
            </Button>
          ))}
        </div>
        <Button type="button" variant="secondary" size="sm" disabled={index >= model.slots.length - 1} onClick={() => actions.resolveAt(model.slots[index + 1].id)}>
          Next →
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>
          Done
        </Button>
      </div>

      {busy.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 text-sm">
          <span className="text-content-secondary">Busy:</span>
          {busy.map(({ row, cell, present }) => (
            <Badge key={row.id} variant={cell?.scenes.length ? 'primary' : 'warning'} size="sm">
              {row.name}: {present.map(name).join(', ')}
              {cell?.scenes.length ? '' : ' · no scene'}
            </Badge>
          ))}
        </div>
      )}

      {flags.length > 0 && (
        <ul className="space-y-1 text-sm">
          {flags.map((f) => {
            const cardId = flagCardId(f);
            return (
              <li key={f.key} className="flex items-center gap-2">
                <span className="flex-1 text-content-primary">{flagSentence(f, model)}</span>
                {cardId && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => actions.openCard(cardId)}>
                    Open card
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {waiting.length > 0 && (
        <div className="space-y-1 text-sm">
          <div className="text-content-secondary">Waiting IF cards for people here:</div>
          {waiting.map((c) => {
            const owner = model.names.get(c.characterId) ?? '?';
            return (
              <div key={c.id} className="flex items-center gap-2">
                <Button type="button" variant="ghost" size="sm" className="!justify-start" onClick={() => actions.openCard(c.id)}>
                  <span className="text-interactive-primary">IF {c.cond || '…'}</span>
                  <span className="ml-1 text-content-primary">
                    {shortName(owner)}: {boardLabel(c, [owner, ...(model.nameLists.get(c.characterId) ?? [])])}
                  </span>
                </Button>
                <Button type="button" variant="secondary" size="sm" onClick={() => actions.moveCard(c, { chunkId })} aria-label={`Trigger it here, in ${slot.name}`}>
                  here ▸
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {!busy.length && !flags.length && !waiting.length && <p className="text-sm text-content-secondary">Nothing left to resolve in this slot.</p>}
    </section>
  );
}
