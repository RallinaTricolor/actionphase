import { useMemo, useState } from 'react';
import { Badge, Button } from '@/components/ui';
import { isWaiting } from '@/lib/gmBoard/cards';
import { isChunkEmpty, type BoardRow } from '@/lib/gmBoard/map';
import { sceneName } from '@/lib/gmBoard/scenes';
import { isAmbush, stanceOf } from '@/lib/gmBoard/stances';
import { shortName } from '@/lib/gmBoard/text';
import type { Card, Chunk } from '@/lib/gmBoard/types';
import { MapArrowLayer, type MapArrows } from './MapArrowLayer';
import { MapCard } from './MapCard';
import { MapDropCell } from './MapDropCell';
import { MapSlotHeader } from './MapSlotHeader';
import { cellContents, isShown, presentIn, type CellContents } from './mapModel';
import type { DragState, MapActions, MapModel } from './mapTypes';
import { stanceText } from './stanceText';

interface MapByLocationProps {
  model: MapModel;
  actions: MapActions;
  drag: DragState;
  arrows?: MapArrows;
}

/**
 * The Map by location: the Contingencies strip, then a grid of locations
 * (rows) by time slots (columns). A cell with two or more people is busy and
 * says whether it has a scene.
 */
export function MapByLocation({ model, actions, drag, arrows }: MapByLocationProps) {
  const cells = useMemo(() => cellContents(model), [model]);
  const { slots, open } = model;
  const shownRows = model.visible
    ? model.rows.filter((r) => slots.some((s) => cellHasShown(cells.get(`${r.id}|${s.id}`), model)))
    : model.rows;
  const todo = (chunkId: string) => open.filter((f) => f.chunkId === chunkId).length;

  return (
    <div className="space-y-4" data-testid="map-by-location">
      <Contingencies model={model} actions={actions} drag={drag} />

      <div className="overflow-x-auto rounded-lg border border-theme-default" role="region" aria-label="Locations by time slot" tabIndex={0}>
        <MapArrowLayer cards={model.board.cards} arrows={arrows} layoutKey={model}>
        <div className="grid" style={{ gridTemplateColumns: `12rem repeat(${slots.length}, minmax(15rem, 1fr))` }}>
          <div className="contents">
            <div className="sticky left-0 z-10 surface-raised border-b border-r border-theme-default p-2 text-xs text-content-tertiary">
              Location ↓ · time →
            </div>
            {slots.map((slot, i) => (
              <div key={slot.id} className="surface-raised border-b border-r border-theme-default">
                <MapSlotHeader
                  slot={slot}
                  index={i}
                  todo={todo(slot.id)}
                  hasCards={model.board.cards.some((c) => c.chunkId === slot.id)}
                  removable={slots.length > 1 && isChunkEmpty(model.board, slot.id)}
                  dimmed={!!model.resolving && model.resolving !== slot.id}
                  onRename={(name) => actions.renameSlot(slot.id, name)}
                  onInsertBefore={() => actions.insertSlotBefore(i)}
                  onRemove={() => actions.removeSlot(slot.id)}
                  onResolve={() => actions.resolveAt(slot.id)}
                  readOnly={actions.readOnly}
                />
              </div>
            ))}
          </div>

          {shownRows.map((row) => (
            <div className="contents" key={row.id}>
              <RowHead row={row} />
              {slots.map((slot) => (
                <LocationCell
                  key={slot.id}
                  row={row}
                  slot={slot}
                  cell={cells.get(`${row.id}|${slot.id}`)}
                  model={model}
                  actions={actions}
                  drag={drag}
                />
              ))}
            </div>
          ))}
        </div>
        </MapArrowLayer>
        {shownRows.length === 0 && (
          <p className="p-4 text-sm text-content-secondary">Nobody in this cluster has a card on the board yet.</p>
        )}
      </div>
    </div>
  );
}

const cellHasShown = (cell: CellContents | undefined, model: MapModel) =>
  !!cell && (cell.cards.some((c) => isShown(model, c.characterId)) || cell.scenes.some((s) => s.participants.some((p) => isShown(model, p))));

function RowHead({ row }: { row: BoardRow }) {
  return (
    <div className="sticky left-0 z-10 surface-raised border-b border-r border-theme-default p-2">
      <div className="font-medium text-content-primary">{row.name}</div>
      {row.kind === 'other' && <div className="text-xs text-content-tertiary">Set for another phase</div>}
      {row.kind === 'missing' && (
        <div className="text-xs text-content-secondary">These cards’ location was deleted. Open each one to pick another.</div>
      )}
    </div>
  );
}

interface LocationCellProps {
  row: BoardRow;
  slot: Chunk;
  cell: CellContents | undefined;
  model: MapModel;
  actions: MapActions;
  drag: DragState;
}

function LocationCell({ row, slot, cell, model, actions, drag }: LocationCellProps) {
  const [showMoot, setShowMoot] = useState(false);
  const cards = (cell?.cards ?? []).filter((c) => isShown(model, c.characterId));
  const live = cards.filter((c) => c.outcome !== 'moot');
  const moot = cards.filter((c) => c.outcome === 'moot');
  const scenes = cell?.scenes ?? [];
  const present = presentIn(cell);
  const busy = present.length >= 2;
  const dimmed = !!model.resolving && model.resolving !== slot.id;
  const missing = row.kind === 'missing';

  return (
    <MapDropCell
      target={{ chunkId: slot.id, locationId: row.id }}
      drag={drag}
      onDrop={(cardId, target) => {
        const card = model.board.cards.find((c) => c.id === cardId);
        if (card) actions.moveCard(card, target);
      }}
      className={`border-b border-r border-theme-default ${dimmed ? 'opacity-40' : ''}`}
      data-testid={`cell-${row.id}-${slot.id}`}
    >
      {busy && <BusyPill model={model} present={present} scenes={scenes} onOpenScene={actions.openScene} />}
      {scenes.map((s) => (
        <Button
          key={s.id}
          type="button"
          variant="ghost"
          size="sm"
          className="!block w-full truncate !px-1 !py-0 text-left text-xs !font-normal"
          title={`Open ${sceneName(s, model.names)} in Scenes`}
          onClick={() => actions.openScene(s.id)}
          data-arrow-id={s.id}
        >
          ▸ {sceneName(s, model.names)}
        </Button>
      ))}
      {busy && !scenes.length && !missing && !actions.readOnly && (
        <Button type="button" variant="secondary" size="sm" className="!px-1.5 !py-0 text-xs" onClick={() => actions.createScene(row.id, slot.id)} aria-label={`Create scene at ${row.name}, ${slot.name}`}>
          Create scene
        </Button>
      )}
      {[...live, ...(showMoot ? moot : [])].map((card) => (
        <CellCard key={card.id} card={card} model={model} actions={actions} drag={drag} />
      ))}
      {moot.length > 0 && (
        <Button type="button" variant="ghost" size="sm" className="!px-1 !py-0 text-xs" onClick={() => setShowMoot((v) => !v)} aria-expanded={showMoot}>
          {showMoot ? 'Hide moot' : `+${moot.length} moot`}
        </Button>
      )}
      {!missing && !actions.readOnly && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="!px-1 !py-0 text-xs opacity-0 focus:opacity-100 group-hover:opacity-100"
          onClick={() => actions.addGmCards({ locationId: row.id, chunkId: slot.id })}
          aria-label={`Add GM cards at ${row.name}, ${slot.name}`}
        >
          + Card
        </Button>
      )}
    </MapDropCell>
  );
}

/** One pill for a busy cell: its scene or conflict (click to open it), or that it has none. Hover for who means what to whom. */
function BusyPill({ model, present, scenes, onOpenScene }: { model: MapModel; present: number[]; scenes: CellContents['scenes']; onOpenScene: (id: string) => void }) {
  const lines: string[] = [];
  for (const a of present) {
    for (const b of present) {
      if (a === b || !stanceOf(model.board.stances, a, b)) continue;
      lines.push(stanceText(model.board.stances, model.names, a, b) + (isAmbush(model.board.stances, a, b) ? ' (they think it’s an alliance)' : ''));
    }
  }
  const who = present.map((id) => shortName(model.names.get(id) ?? '?')).join(', ');
  const title = [`Here: ${who}`, ...(lines.length ? lines : ['No stances set between them.'])].join('\n');
  const conflict = scenes.some((s) => s.conflict);
  return (
    <div className="flex flex-wrap items-center gap-1" title={title}>
      {scenes.length ? (
        <Button type="button" variant="ghost" size="sm" className="!p-0" aria-label={`Open the ${conflict ? 'conflict' : 'scene'} here`} onClick={() => onOpenScene((scenes.find((s) => s.conflict) ?? scenes[0]).id)}>
          <Badge variant={conflict ? 'danger' : 'primary'} size="sm">
            {conflict ? 'Conflict' : 'Scene'}
          </Badge>
        </Button>
      ) : (
        <Badge variant="warning" size="sm">
          Busy · no scene
        </Badge>
      )}
      <span className="truncate text-xs text-content-secondary">{who}</span>
    </div>
  );
}

function CellCard({ card, model, actions, drag }: { card: Card; model: MapModel; actions: MapActions; drag: DragState }) {
  return (
    <MapCard
      card={card}
      owner={model.cast.get(card.characterId)}
      ownerNames={model.nameLists.get(card.characterId) ?? []}
      flagged={model.outCards.has(card.id)}
      dragging={drag.cardId === card.id}
      onOpen={actions.openCard}
      onDragStart={actions.readOnly ? undefined : drag.start}
      onDragEnd={drag.end}
    />
  );
}

/** IF cards waiting to trigger. Drop one on a cell to trigger it; drop an IF card here to make it wait again. */
function Contingencies({ model, actions, drag }: MapByLocationProps) {
  const waiting = model.board.cards.filter((c) => isWaiting(c) && isShown(model, c.characterId));
  return (
    <section aria-label="Contingencies" className="rounded-lg border border-theme-default surface-raised">
      <MapDropCell
        target={{ chunkId: null }}
        drag={drag}
        onDrop={(cardId, target) => {
          const card = model.board.cards.find((c) => c.id === cardId);
          if (card) actions.moveCard(card, target);
        }}
        data-testid="contingencies"
      >
        <div className="flex items-baseline gap-2">
          <h3 className="text-sm font-semibold text-content-primary">Contingencies</h3>
          <span className="text-xs text-content-tertiary">
            {actions.readOnly ? 'IF cards waiting to trigger.' : 'IF cards waiting to trigger. Drag one into a time slot when it does.'}
          </span>
        </div>
        {waiting.length ? (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(14rem,1fr))] gap-1.5">
            {waiting.map((card) => (
              <CellCard key={card.id} card={card} model={model} actions={actions} drag={drag} />
            ))}
          </div>
        ) : (
          <p className="text-xs text-content-secondary">None waiting.</p>
        )}
      </MapDropCell>
    </section>
  );
}

