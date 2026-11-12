import { Badge, Button } from '@/components/ui';
import CharacterAvatar from '@/components/characters/CharacterAvatar';
import { sceneName } from '@/lib/gmBoard/scenes';
import { isWaiting } from '@/lib/gmBoard/cards';
import { locationAt } from '@/lib/gmBoard/map';
import { outEntering, stateAt } from '@/lib/gmBoard/states';
import type { Card } from '@/lib/gmBoard/types';
import { MapArrowLayer, type MapArrows } from './MapArrowLayer';
import { MapCard } from './MapCard';
import { MapDropCell } from './MapDropCell';
import { characterGroups, STATE_LABELS, STATE_TONE } from './mapModel';
import type { DragState, MapActions, MapModel } from './mapTypes';

interface MapByCharacterProps {
  model: MapModel;
  actions: MapActions;
  drag: DragState;
  arrows?: MapArrows;
}

/**
 * The Map by character: a row per player, grouped by cluster (NPCs last),
 * with Contingencies as the first column. Slots where someone is out of play
 * are hatched, and a badge marks where their state changes. A card can only
 * be dragged along its own row.
 */
export function MapByCharacter({ model, actions, drag, arrows }: MapByCharacterProps) {
  const groups = characterGroups(model);
  const { slots } = model;
  const byCell = new Map<string, Card[]>();
  for (const c of model.board.cards) {
    const key = `${c.characterId}|${c.chunkId ?? ''}`;
    byCell.set(key, [...(byCell.get(key) ?? []), c]);
  }
  const place = (id: string) => model.rows.find((r) => r.id === id)?.name ?? 'No location';

  return (
    <div className="overflow-x-auto rounded-lg border border-theme-default surface-base" role="region" aria-label="Characters by time slot" tabIndex={0} data-testid="map-by-character">
      <MapArrowLayer cards={model.board.cards} arrows={arrows} layoutKey={model}>
      <div className="grid" style={{ gridTemplateColumns: `12rem minmax(13rem, 1fr) repeat(${slots.length}, minmax(13rem, 1fr))` }}>
        <div className="contents">
          <div className="sticky left-0 z-10 surface-sunken border-b border-r border-theme-default p-2 text-xs text-content-tertiary">Character ↓ · time →</div>
          <div className="surface-sunken border-b border-r border-theme-default p-2 text-sm font-medium text-content-primary">Contingencies</div>
          {slots.map((s, i) => (
            <div key={s.id} className={`surface-sunken border-b border-r border-theme-default p-2 text-sm font-medium text-content-primary ${model.resolving && model.resolving !== s.id ? 'opacity-50' : ''}`}>
              <span className="mr-1 text-xs text-content-tertiary">{i + 1}</span>
              {s.name}
            </div>
          ))}
        </div>

        {groups.map((g) => (
          <div className="contents" key={g.id}>
            <div className="sticky left-0 z-10 col-span-full surface-sunken border-b border-theme-default px-2 py-1 text-xs font-semibold uppercase tracking-wide text-content-secondary">
              {g.name}
            </div>
            {g.characterIds.map((id) => {
              const member = model.cast.get(id);
              const name = model.names.get(id) ?? `Character ${id}`;
              return (
                <div className="contents" key={id} data-testid={`character-row-${id}`}>
                  <div className="sticky left-0 z-10 surface-sunken border-b border-r border-theme-default p-2">
                    <div className="flex items-center gap-1.5">
                      <CharacterAvatar avatarUrl={member?.avatarUrl} characterName={name} size="xs" />
                      <span className="truncate font-medium text-content-primary">{name}</span>
                    </div>
                    <div className="mt-1 flex gap-1">
                      {model.submitters.has(id) && (
                        <Button type="button" variant="ghost" size="sm" className="!px-1 !py-0 text-xs" onClick={() => actions.readSubmission(id)} aria-label={`Read ${name}’s submission`}>
                          Read
                        </Button>
                      )}
                      {!member?.npc && (
                        <Button type="button" variant="ghost" size="sm" className="!px-1 !py-0 text-xs" onClick={() => actions.openStances(id)} aria-label={`${name}’s stances`}>
                          Stances
                        </Button>
                      )}
                    </div>
                  </div>
                  <MapDropCell
                    target={{ chunkId: null, characterId: id }}
                    drag={drag}
                    onDrop={(cardId, target) => move(model, actions, cardId, target)}
                    className="border-b border-r border-theme-default"
                  >
                    {(byCell.get(`${id}|`) ?? []).filter(isWaiting).map((c) => (
                      <RowCard key={c.id} card={c} model={model} actions={actions} drag={drag} />
                    ))}
                  </MapDropCell>
                  {slots.map((s, i) => {
                    const out = outEntering(model.states, id, i);
                    const state = stateAt(model.states, id, i);
                    const changed = i > 0 ? stateAt(model.states, id, i - 1) !== state : state !== 'active';
                    const cards = byCell.get(`${id}|${s.id}`) ?? [];
                    const where = locationAt(model.board, id, i);
                    return (
                      <MapDropCell
                        key={s.id}
                        target={{ chunkId: s.id, characterId: id }}
                        drag={drag}
                        onDrop={(cardId, target) => move(model, actions, cardId, target)}
                        className={`border-b border-r border-theme-default ${out ? 'gm-out-of-play' : ''} ${model.resolving && model.resolving !== s.id ? 'opacity-40' : ''}`}
                        title={out ? `${name} is ${STATE_LABELS[out].toLowerCase()} here` : undefined}
                        data-testid={`char-cell-${id}-${s.id}`}
                      >
                        {changed && (
                          <Badge variant={STATE_TONE[state]} size="sm">
                            {STATE_LABELS[state]}
                          </Badge>
                        )}
                        {model.board.scenes
                          .filter((sc) => sc.chunkId === s.id && sc.participants.includes(id))
                          .map((sc) => (
                            <Button
                              key={sc.id}
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="!block w-full truncate !px-1 !py-0 text-left text-xs !font-normal"
                              title={`Open ${sceneName(sc, model.names)} in Scenes`}
                              onClick={() => actions.openScene(sc.id)}
                              data-arrow-id={sc.id}
                            >
                              <Badge variant={sc.conflict ? 'danger' : 'primary'} size="sm">
                                {sc.conflict ? 'Conflict' : 'Scene'}
                              </Badge>{' '}
                              {place(sc.locationId)}: {sceneName(sc, model.names)}
                            </Button>
                          ))}
                        {cards.map((c) => (
                          <div key={c.id}>
                            <div className="truncate text-xs text-content-tertiary">{place(c.locationId)}</div>
                            <RowCard card={c} model={model} actions={actions} drag={drag} />
                          </div>
                        ))}
                        {!actions.readOnly && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="!px-1 !py-0 text-xs opacity-0 focus:opacity-100 group-hover:opacity-100"
                            onClick={() => actions.addGmCards({ characterIds: [id], chunkId: s.id, locationId: where ?? undefined })}
                            aria-label={`Add a GM card for ${name} in ${s.name}`}
                          >
                            + GM card
                          </Button>
                        )}
                      </MapDropCell>
                    );
                  })}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      </MapArrowLayer>
    </div>
  );
}

function move(model: MapModel, actions: MapActions, cardId: string, target: { chunkId: string | null; characterId?: number }) {
  const card = model.board.cards.find((c) => c.id === cardId);
  if (card) actions.moveCard(card, target);
}

function RowCard({ card, model, actions, drag }: { card: Card; model: MapModel; actions: MapActions; drag: DragState }) {
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

