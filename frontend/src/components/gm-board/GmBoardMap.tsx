import { useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button, Card, CardBody, Drawer, Select, Spinner } from '@/components/ui';
import { useToast } from '@/contexts/ToastContext';
import { useArrowMode } from '@/hooks/useArrowMode';
import { useBoardCardActions } from '@/hooks/useBoardCardActions';
import { useBoardReadOnly } from '@/hooks/useBoardReadOnly';
import { useBoardPeople } from '@/hooks/useBoardPeople';
import { useGmBoardStore, useGmSettingsStore } from '@/hooks/useGmBoard';
import { ARROW_MODES, isArrowMode } from '@/lib/gmBoard/arrows';
import { cardDoc, newCard } from '@/lib/gmBoard/cards';
import { codexDoc, newCodexEntry } from '@/lib/gmBoard/codex';
import type { BoardFlag } from '@/lib/gmBoard/flags';
import { dropCard, nextSlotName, positionAtEnd, positionBefore } from '@/lib/gmBoard/map';
import { DEFAULT_CHUNKS } from '@/lib/gmBoard/read';
import { newScene, sceneDoc } from '@/lib/gmBoard/scenes';
import { stanceKey } from '@/lib/gmBoard/stances';
import { newItemKey } from '@/lib/gmBoard/store';
import type { BoardDoc, Card as BoardCard, Chunk, Cluster, Stance, StanceValue } from '@/lib/gmBoard/types';
import type { GamePhase } from '@/types/phases';
import { CardPanel } from './CardPanel';
import { CharacterStateTable } from './CharacterStateTable';
import { ClusterEditor } from './ClusterEditor';
import { GmCardsForm, type GmCardsRequest } from './GmCardsForm';
import { MapByCharacter } from './MapByCharacter';
import { MapByLocation } from './MapByLocation';
import { MapChecks } from './MapChecks';
import { MapResolveBar } from './MapResolveBar';
import { buildMapModel } from './mapModel';
import type { DragState, DropTarget, MapActions } from './mapTypes';
import { StanceMatrix } from './StanceMatrix';

interface GmBoardMapProps {
  gameId: number;
  phase: GamePhase;
  board: BoardDoc;
  onOpenCodex: (name?: string) => void;
  /** Opens a submission in Read. */
  onReadSubmission: (characterId: number) => void;
  /** Opens a scene in the Scenes step. */
  onOpenScene: (sceneId: string) => void;
}

const VIEWS = [
  { id: 'location', label: 'By location' },
  { id: 'character', label: 'By character' },
  { id: 'stances', label: 'Stances' },
] as const;
type MapView = (typeof VIEWS)[number]['id'];
const parseView = (v: string | null): MapView => (VIEWS.some((x) => x.id === v) ? (v as MapView) : 'location');

const REFUSED: Record<'other-character' | 'not-if' | 'no-location', string> = {
  'other-character': 'Cards stay in their own character’s row. To give a GM card to someone else, open it and change whose it is.',
  'not-if': 'Only IF cards wait in Contingencies. Open the card and tick IF first.',
  'no-location': '“No location” is for cards whose location was deleted. Drop it on a location.',
};

type Doc = Omit<BoardCard, 'id'>;

/**
 * The Map step: cards on a grid of locations (or characters) by time slots,
 * with checks for likely mistakes, Resolve mode, clusters and stances. The
 * view and cluster are in the URL (`?view=`, `?cluster=`).
 */
export function GmBoardMap({ gameId, phase, board, onOpenCodex, onReadSubmission, onOpenScene }: GmBoardMapProps) {
  const [params, setParams] = useSearchParams();
  const view = parseView(params.get('view'));
  const clusterId = params.get('cluster');
  const { showToast } = useToast();
  const readOnly = useBoardReadOnly();
  const store = useGmBoardStore(gameId, phase.id);
  const settingsStore = useGmSettingsStore(gameId);
  const { cast, names, nameLists, submitters, settings, canRead, isLoading } = useBoardPeople(gameId, phase.id);

  const [openCardId, setOpenCardId] = useState<string | null>(null);
  const [resolving, setResolving] = useState<string | null>(null);
  const [gmCards, setGmCards] = useState<Parameters<MapActions['addGmCards']>[0] | null>(null);
  const [clustersOpen, setClustersOpen] = useState(false);
  const [stanceFocus, setStanceFocus] = useState<number | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [arrowMode, setArrowMode] = useArrowMode();

  const cluster = board.clusters.find((c) => c.id === clusterId) ?? null;
  const model = useMemo(
    () =>
      buildMapModel({
        board,
        codex: settings?.codex ?? [],
        phaseId: phase.id,
        cast,
        names,
        nameLists,
        submitters,
        visible: cluster?.characterIds ?? null,
        resolving,
      }),
    [board, settings?.codex, phase.id, cast, names, nameLists, submitters, cluster, resolving],
  );
  const pickable = useMemo(() => model.rows.filter((r) => r.kind !== 'missing'), [model.rows]);
  const cardActions = useBoardCardActions(gameId, phase.id, board, names);

  const drag = useMemo<DragState>(() => ({ cardId: dragId, start: setDragId, end: () => setDragId(null) }), [dragId]);

  const setParam = useCallback(
    (key: string, value: string | null) => {
      const next = new URLSearchParams(params);
      if (value === null) next.delete(key);
      else next.set(key, value);
      setParams(next);
    },
    [params, setParams],
  );

  const createLocation = (name: string) => {
    const entry = newCodexEntry({ id: newItemKey('cx'), type: 'Location', name });
    settingsStore.update('codex', entry.id, () => codexDoc(entry));
    return entry.id;
  };

  const putChunk = (c: Chunk) => store.update('chunk', c.id, () => ({ name: c.name, position: c.position }));
  const addSlot = (position: number) => {
    const slot = { id: newItemKey('slot'), name: nextSlotName(board.chunks), position };
    putChunk(slot);
    showToast(`Added ${slot.name}.`, 'success');
  };

  const slotName = (id: string | null) => (id === null ? 'Contingencies' : (board.chunks.find((c) => c.id === id)?.name ?? ''));
  const rowName = (id: string) => model.rows.find((r) => r.id === id)?.name ?? '';

  const actions: MapActions = {
    readOnly,
    openCard: setOpenCardId,
    addGmCards: setGmCards,
    moveCard: (card, target: DropTarget) => {
      const result = dropCard(card, target);
      if (!result.ok) {
        showToast(REFUSED[result.reason], 'warning');
        return;
      }
      const { fields } = result;
      if (fields.chunkId === card.chunkId && (fields.locationId ?? card.locationId) === card.locationId) return;
      cardActions.change(card, fields);
      const where = fields.chunkId === null ? 'Contingencies' : `${rowName(fields.locationId ?? card.locationId)} · ${slotName(fields.chunkId)}`;
      showToast(result.triggered ? `IF card triggered: now in ${where}.` : `Moved to ${where}.`, 'info', {
        action: { label: 'Undo', onClick: () => cardActions.change(card, { chunkId: card.chunkId, locationId: card.locationId }) },
      });
    },
    renameSlot: (id, name) => store.update<Omit<Chunk, 'id'>>('chunk', id, (cur) => ({ position: 0, ...cur, name })),
    insertSlotBefore: (index) => addSlot(positionBefore(board.chunks, index)),
    removeSlot: (id) => {
      const slot = board.chunks.find((c) => c.id === id);
      if (!slot) return;
      store.remove('chunk', id);
      if (resolving === id) setResolving(null);
      showToast(`Removed ${slot.name}.`, 'info', { action: { label: 'Undo', onClick: () => putChunk(slot) } });
    },
    resolveAt: setResolving,
    readSubmission: onReadSubmission,
    openStances: (id) => {
      setStanceFocus(id);
      setParam('view', 'stances');
    },
    createScene: (locationId, chunkId) => {
      const scene = newScene(board, { locationId, chunkId }, { scene: newItemKey('scene'), moment: newItemKey('m') }, canRead);
      store.update('scene', scene.id, () => sceneDoc(scene));
      onOpenScene(scene.id);
    },
    openScene: onOpenScene,
  };

  const dismiss = (flag: BoardFlag) => {
    store.update('flag', flag.key, () => ({}));
    showToast('Check dismissed.', 'info', { action: { label: 'Undo', onClick: () => store.remove('flag', flag.key) } });
  };

  const setStance = (from: number, to: number, stance: Stance) => store.update<Stance>('stance', stanceKey(from, to), () => stance);
  const setMany = (keys: string[], value: StanceValue | '') => {
    const before = keys.map((k) => [k, board.stances[k]] as const);
    keys.forEach((k) => store.update<Stance>('stance', k, (cur) => ({ ...cur, value })));
    showToast(`Set ${keys.length} stance${keys.length === 1 ? '' : 's'}.`, 'success', {
      action: {
        label: 'Undo',
        onClick: () => before.forEach(([k, s]) => (s ? store.update<Stance>('stance', k, () => s) : store.remove('stance', k))),
      },
    });
  };

  const addGmCards = ({ characterIds, locationId, chunkId, summary }: GmCardsRequest) => {
    const made = characterIds.map((characterId) => newCard({ id: newItemKey('card'), characterId, locationId, chunkId, summary, gm: true }));
    made.forEach((c) => store.update<Doc>('card', c.id, () => cardDoc(c)));
    setGmCards(null);
    showToast(`Added ${made.length} GM card${made.length === 1 ? '' : 's'} to ${rowName(locationId)} · ${slotName(chunkId)}.`, 'success', {
      action: { label: 'Undo', onClick: () => made.forEach((c) => store.remove('card', c.id)) },
    });
  };

  const saveCluster = (c: Cluster) => store.update('cluster', c.id, () => ({ name: c.name, characterIds: c.characterIds }));
  const createCluster = (name: string, characterIds: number[]) => {
    for (const other of board.clusters) {
      if (other.characterIds.some((id) => characterIds.includes(id))) saveCluster({ ...other, characterIds: other.characterIds.filter((id) => !characterIds.includes(id)) });
    }
    saveCluster({ id: newItemKey('cluster'), name, characterIds });
  };
  const removeCluster = (id: string) => {
    const c = board.clusters.find((x) => x.id === id);
    store.remove('cluster', id);
    if (clusterId === id) setParam('cluster', null);
    if (c) showToast(`Deleted ${c.name || 'the cluster'}.`, 'info', { action: { label: 'Undo', onClick: () => saveCluster(c) } });
  };

  if (!settings || isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!model.rows.length) {
    return (
      <Card variant="bordered" padding="md" data-testid="gm-board-step-map">
        <CardBody className="space-y-3">
          <p className="text-content-primary">The Map’s rows are this phase’s locations, and there are none yet.</p>
          {!readOnly && (
            <Button type="button" variant="primary" onClick={() => onOpenCodex()}>
              Add a location in the codex
            </Button>
          )}
        </CardBody>
      </Card>
    );
  }
  if (!model.slots.length) {
    return (
      <Card variant="bordered" padding="md" data-testid="gm-board-step-map">
        <CardBody className="space-y-3">
          <p className="text-content-primary">The Map’s columns are time slots, and there are none yet.</p>
          {!readOnly && (
            <Button type="button" variant="primary" onClick={() => DEFAULT_CHUNKS.forEach(putChunk)}>
              Add Pre-Scenario and Slots 1–3
            </Button>
          )}
        </CardBody>
      </Card>
    );
  }

  const players = cast.filter((c) => !c.npc);
  const openCard = board.cards.find((c) => c.id === openCardId) ?? null;
  const arrows = { mode: arrowMode, openId: openCard?.id ?? null };
  const stancePlayers = players.filter((p) => !model.visible || model.visible.has(p.id));

  return (
    <div className="space-y-3" data-testid="gm-board-step-map">
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex gap-1" role="group" aria-label="View">
          {VIEWS.map((v) => (
            <Button key={v.id} type="button" size="sm" variant={view === v.id ? 'primary' : 'secondary'} aria-pressed={view === v.id} onClick={() => setParam('view', v.id === 'location' ? null : v.id)}>
              {v.label}
            </Button>
          ))}
        </div>
        <div className="w-48">
          <Select id="map-cluster" aria-label="Cluster" selectSize="sm" value={cluster?.id ?? ''} onChange={(e) => setParam('cluster', e.target.value || null)}>
            <option value="">Everyone</option>
            {board.clusters.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name || 'Unnamed cluster'}
              </option>
            ))}
          </Select>
        </div>
        {!readOnly && (
          <Button type="button" size="sm" variant="ghost" onClick={() => setClustersOpen(true)}>
            Edit clusters
          </Button>
        )}
        {view !== 'stances' && (
          <div className="w-36">
            <Select
              id="map-arrows"
              aria-label="Arrows"
              title="Arrows show what caused each card"
              selectSize="sm"
              value={arrowMode}
              onChange={(e) => isArrowMode(e.target.value) && setArrowMode(e.target.value)}
            >
              {ARROW_MODES.map((m) => (
                <option key={m.value} value={m.value}>
                  Arrows: {m.label.toLowerCase()}
                </option>
              ))}
            </Select>
          </div>
        )}
        <span className="flex-1" />
        {view !== 'stances' && !readOnly && (
          <>
            <Button type="button" size="sm" variant="secondary" onClick={() => setGmCards({})}>
              + GM cards…
            </Button>
            <Button type="button" size="sm" variant="secondary" onClick={() => addSlot(positionAtEnd(board.chunks))}>
              + Time slot
            </Button>
            <Button type="button" size="sm" variant={resolving ? 'primary' : 'secondary'} onClick={() => setResolving(resolving ? null : (model.slots.find((s) => model.open.some((f) => f.chunkId === s.id)) ?? model.slots[0]).id)}>
              {resolving ? 'Stop resolving' : 'Resolve ▸'}
            </Button>
          </>
        )}
      </div>

      {view === 'stances' ? (
        <StanceMatrix stances={board.stances} players={stancePlayers} names={names} focusId={stanceFocus} onSet={setStance} onSetMany={setMany} readOnly={readOnly} />
      ) : (
        <div className="flex items-start gap-4">
          <div className="min-w-0 flex-1 space-y-3">
            {model.resolving && <MapResolveBar model={model} chunkId={model.resolving} actions={actions} onClose={() => setResolving(null)} />}
            {view === 'location' ? (
              <>
                <MapByLocation model={model} actions={actions} drag={drag} arrows={arrows} />
                <CharacterStateTable model={model} />
              </>
            ) : (
              <MapByCharacter model={model} actions={actions} drag={drag} arrows={arrows} />
            )}
          </div>
          <div className="sticky top-4 w-80 shrink-0 self-start max-h-[calc(100vh-2rem)] overflow-y-auto xl:w-96">
            {openCard ? (
              <CardPanel
                key={openCard.id}
                card={openCard}
                board={board}
                names={names}
                locations={pickable}
                cast={cast}
                onChange={(fields) => cardActions.change(openCard, fields)}
                onCreateLocation={createLocation}
                onSplit={(at) => cardActions.split(openCard, at)}
                onPushLater={() => cardActions.pushLater(openCard)}
                onDelete={() => {
                  cardActions.remove(openCard);
                  setOpenCardId(null);
                }}
                onClose={() => setOpenCardId(null)}
                onReadSubmission={!openCard.gm && submitters.includes(openCard.characterId) ? () => onReadSubmission(openCard.characterId) : undefined}
                readOnly={readOnly}
              />
            ) : (
              <MapChecks
                model={model}
                onOpenCard={setOpenCardId}
                onResolveAt={setResolving}
                onDismiss={dismiss}
                onRestore={(f) => store.remove('flag', f.key)}
                onCreateScene={actions.createScene}
                onOpenScene={onOpenScene}
                readOnly={readOnly}
              />
            )}
          </div>
        </div>
      )}

      <Drawer open={gmCards !== null} onClose={() => setGmCards(null)} title="GM cards" side="right">
        {gmCards !== null && (
          <GmCardsForm
            key={JSON.stringify(gmCards)}
            cast={cast}
            locations={pickable}
            slots={model.slots}
            prefill={gmCards}
            onCreateLocation={createLocation}
            onSubmit={addGmCards}
            onCancel={() => setGmCards(null)}
          />
        )}
      </Drawer>

      <Drawer open={clustersOpen} onClose={() => setClustersOpen(false)} title="Clusters" side="right">
        <ClusterEditor board={board} players={players} onSave={saveCluster} onRemove={removeCluster} onCreate={createCluster} />
      </Drawer>
    </div>
  );
}
