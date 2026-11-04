import { useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button, Card, CardBody, Spinner } from '@/components/ui';
import { useToast } from '@/contexts/ToastContext';
import { useBoardCardActions } from '@/hooks/useBoardCardActions';
import { useBoardPeople } from '@/hooks/useBoardPeople';
import { useGameCharacterSheetItems } from '@/hooks/useCharacterSheetItems';
import { useGameActionResults } from '@/hooks/useActionResults';
import { useGmBoardStore } from '@/hooks/useGmBoard';
import { useAppendToDraft } from '@/hooks/useResultDraft';
import { isCovered, setCovered } from '@/lib/gmBoard/coverage';
import { chainsFor, draftTexts, targetPart } from '@/lib/gmBoard/results';
import { inPhase } from '@/lib/gmBoard/codex';
import { boardRows, NO_LOCATION, sortedChunks } from '@/lib/gmBoard/map';
import { insertMoment, joinScene, leaveScene, newMoment, sceneReaders, scenesInOrder } from '@/lib/gmBoard/moments';
import type { NamedCharacter } from '@/lib/gmBoard/read';
import { insertAt } from '@/lib/insertText';
import { cardsCitingScene, moveMoment, removeEffect, removeMoment, sceneDoc, sceneName, sceneNeighbours, updateMoment } from '@/lib/gmBoard/scenes';
import { characterStates, chunkIndex } from '@/lib/gmBoard/states';
import { newItemKey } from '@/lib/gmBoard/store';
import { shortName } from '@/lib/gmBoard/text';
import type { BoardDoc, Card as BoardCard, CharacterProgress, Moment, Scene } from '@/lib/gmBoard/types';
import type { GamePhase } from '@/types/phases';
import { MomentEditor } from './MomentEditor';
import { SceneRewards } from './SceneRewards';
import { SceneCast } from './SceneCast';
import { SceneHeader } from './SceneHeader';
import { SceneReadsAs } from './SceneReadsAs';
import { SceneReference } from './SceneReference';
import { SceneSideBySide } from './SceneSideBySide';
import { momentTextId, type MomentActions, type MomentField, type SceneModel } from './sceneTypes';

interface GmBoardScenesProps {
  gameId: number;
  phase: GamePhase;
  board: BoardDoc;
  onGoToMap: () => void;
  /** characterId → the result part last picked in Write, where "Add to draft" goes. */
  selectedParts: Record<number, number | null>;
  onSelectPart: (characterId: number, partId: number | null) => void;
  onWrite: (characterId: number) => void;
}

type SceneDocument = Omit<Scene, 'id'>;

/**
 * The Scenes step: one scene at a time (`?scene=`; with none, the first in
 * time order). The header picks and walks scenes; below it, Reference on the
 * left, the moments in the middle, and the scene as one reader gets it on
 * the right (or every reader side by side across both).
 */
export function GmBoardScenes({ gameId, phase, board, onGoToMap, selectedParts, onSelectPart, onWrite }: GmBoardScenesProps) {
  const [params, setParams] = useSearchParams();
  const { showToast } = useToast();
  const store = useGmBoardStore(gameId, phase.id);
  const people = useBoardPeople(gameId, phase.id);
  const { cast, names, nameLists, submissions, submissionIds, canRead, settings } = people;
  const sheetItems = useGameCharacterSheetItems(gameId);
  const cardActions = useBoardCardActions(gameId, phase.id, board, names);
  const results = useGameActionResults(gameId);
  const appendToDraft = useAppendToDraft(gameId);
  const [adding, setAdding] = useState(false);

  const [view, setView] = useState<'moments' | 'side'>('moments');
  const [reader, setReader] = useState<number | null>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [autoFocusId, setAutoFocusId] = useState<string | null>(null);
  const lastField = useRef<MomentField | null>(null);

  const ordered = useMemo(() => scenesInOrder(board), [board]);
  const wanted = params.get('scene');
  const scene = ordered.find((s) => s.id === wanted) ?? ordered[0] ?? null;

  const codex = useMemo(() => (settings?.codex ?? []).filter((e) => inPhase(e, phase.id)), [settings?.codex, phase.id]);
  const rows = useMemo(() => boardRows(settings?.codex ?? [], phase.id, board.cards), [settings?.codex, phase.id, board.cards]);
  const locations = useMemo(() => rows.filter((r) => r.kind !== 'missing'), [rows]);
  const slots = useMemo(() => sortedChunks(board.chunks), [board.chunks]);
  const characters = useMemo<NamedCharacter[]>(() => [...nameLists].map(([id, list]) => ({ id, names: list })), [nameLists]);

  const model = useMemo<SceneModel | null>(() => {
    if (!scene) return null;
    const allNames = new Map(names);
    scene.participants.forEach((id) => allNames.has(id) || allNames.set(id, `Character ${id}`));
    return {
      board,
      scene,
      names: allNames,
      cast: new Map(cast.map((c) => [c.id, c])),
      canRead,
      nameLists,
      secondPerson: settings?.secondPerson ?? true,
      readers: sceneReaders(scene, canRead),
      states: characterStates(board),
      slotIndex: chunkIndex(board).get(scene.chunkId) ?? -1,
    };
  }, [scene, board, names, cast, canRead, nameLists, settings?.secondPerson]);

  if (people.isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!scene || !model) {
    return (
      <Card variant="bordered" padding="md" data-testid="gm-board-step-scenes">
        <CardBody className="space-y-3">
          <p className="text-content-primary">No scenes yet.</p>
          <p className="text-sm text-content-secondary">
            Scenes are made on the Map: a cell where two or more people meet offers “Create scene”, with its place, time and cast filled in.
          </p>
          <Button type="button" variant="primary" onClick={onGoToMap}>
            Go to the Map
          </Button>
        </CardBody>
      </Card>
    );
  }

  const placeName = (id: string) => rows.find((r) => r.id === id && r.id !== NO_LOCATION)?.name ?? 'No location';
  const slotName = (id: string | null) => (id === null ? 'Contingencies' : (board.chunks.find((c) => c.id === id)?.name ?? 'a deleted time slot'));
  const who = (id: number) => shortName(model.names.get(id) ?? `Character ${id}`);

  // Every edit starts from the latest copy, so quick edits in a row build on each other.
  const put = (s: Scene) => store.update<SceneDocument>('scene', s.id, () => sceneDoc(s));
  const edit = (fn: (s: Scene) => Scene) =>
    store.update<SceneDocument>('scene', scene.id, (cur) => sceneDoc(fn(cur ? { ...scene, ...cur, id: scene.id } : scene)));

  const go = (id: string | null) => {
    const next = new URLSearchParams(params);
    if (id) next.set('scene', id);
    else next.delete('scene');
    setParams(next);
    setFocusedId(null);
    lastField.current = null;
  };

  /** A new moment after `afterId` (or the focused one, or at the end). `prepare` changes the scene first, such as adding someone. */
  const addMomentAfter = (afterId: string | null, fields: Partial<Omit<Moment, 'id'>> = {}, prepare = (s: Scene) => s) => {
    const id = newItemKey('m');
    const anchor = afterId ?? focusedId;
    edit((current) => {
      const s = prepare(current);
      const i = s.moments.findIndex((m) => m.id === anchor);
      return insertMoment(s, newMoment(s, canRead, id, fields), i >= 0 ? i + 1 : s.moments.length);
    });
    setFocusedId(id);
    setAutoFocusId(id);
  };

  const momentActions: MomentActions = {
    change: (id, fn) => edit((s) => updateMoment(s, id, fn)),
    addAfter: (id) => addMomentAfter(id),
    move: (id, by) => edit((s) => moveMoment(s, id, by)),
    remove: (id) => {
      const before = scene;
      edit((s) => removeMoment(s, id));
      showToast('Moment deleted.', 'info', { action: { label: 'Undo', onClick: () => put(before) } });
    },
    focus: setFocusedId,
    field: (f) => {
      lastField.current = f;
    },
  };

  const join = (id: number) => edit((s) => joinScene(s, id, canRead));
  const leave = (id: number) => {
    const before = scene;
    edit((s) => leaveScene(s, id));
    showToast(`${who(id)} left the scene.`, 'info', { action: { label: 'Undo', onClick: () => put(before) } });
  };

  const deleteScene = () => {
    const before = scene;
    const citing = cardsCitingScene(board.cards, scene.id);
    const cited = board.cards.filter((c) => citing.some((x) => x.id === c.id));
    const { next, prev } = sceneNeighbours(board, scene.id);
    store.remove('scene', scene.id);
    citing.forEach((c) => cardActions.change(c, { causedBy: c.causedBy }));
    go(next?.id ?? prev?.id ?? null);
    showToast(`Deleted ${sceneName(before, model.names)}.`, 'info', {
      action: {
        label: 'Undo',
        onClick: () => {
          put(before);
          cited.forEach((c) => cardActions.change(c, { causedBy: c.causedBy }));
        },
      },
    });
  };

  const insert = (text: string) => {
    const f = lastField.current;
    const moment = f && scene.moments.find((m) => m.id === f.momentId);
    if (!f || !moment || (f.readerId !== null && typeof moment.ownText[f.readerId] !== 'string')) {
      showToast('Click into a moment first, then Insert.', 'info');
      return;
    }
    const value = f.readerId === null ? moment.text : moment.ownText[f.readerId];
    const result = insertAt(value, f.start, f.end, text);
    momentActions.change(moment.id, (m) =>
      f.readerId === null ? { ...m, text: result.value } : { ...m, ownText: { ...m.ownText, [f.readerId]: result.value } },
    );
    lastField.current = { ...f, start: result.cursor, end: result.cursor };
    // Put the cursor back once the box has the new text.
    window.setTimeout(() => {
      const box = document.getElementById(momentTextId(moment.id, f.readerId)) as HTMLTextAreaElement | null;
      if (box && box.value === result.value) {
        box.focus();
        box.setSelectionRange(result.cursor, result.cursor);
      }
    }, 60);
  };

  // The card's owner joins the scene if they aren't in it.
  const momentFromCard = (card: BoardCard) => addMomentAfter(null, { cardId: card.id }, (s) => joinScene(s, card.characterId, canRead));

  const trigger = (card: BoardCard) => {
    cardActions.change(card, { chunkId: scene.chunkId, locationId: scene.locationId });
    showToast(`${who(card.characterId)}’s IF card triggered here. Set its outcome.`, 'success', {
      action: { label: 'Undo', onClick: () => cardActions.change(card, { chunkId: card.chunkId, locationId: card.locationId }) },
    });
  };

  const inDraft = (m: Moment, characterId: number) => {
    const drafts = draftTexts(chainsFor(results.data ?? [], phase.id, characterId));
    return isCovered(m, characterId, drafts, board.covered[characterId], { names: nameLists.get(characterId) ?? [], secondPerson: model.secondPerson });
  };

  const addToDraft = async (characterId: number, moments: Moment[], text: string) => {
    const chains = chainsFor(results.data ?? [], phase.id, characterId);
    const target = targetPart(chains, selectedParts[characterId]);
    const userId = cast.find((c) => c.id === characterId)?.userId;
    if (!target && userId === undefined) {
      showToast(`Nobody plays ${who(characterId)}, so there’s no draft to add to.`, 'warning');
      return;
    }
    setAdding(true);
    try {
      const part = await appendToDraft(target, text, {
        userId: userId as number,
        characterId,
        submissionId: chains.length ? undefined : submissionIds.get(characterId),
      });
      onSelectPart(characterId, part.id);
      store.update<CharacterProgress>('progress', String(characterId), (p) => moments.reduce((acc, m) => setCovered(acc, m.id, true), p ?? {}));
      showToast(`Added to ${who(characterId)}’s draft.`, 'success', { action: { label: `Write ${who(characterId)}’s result`, onClick: () => onWrite(characterId) } });
    } catch {
      showToast(`Couldn’t add to ${who(characterId)}’s draft. Try again.`, 'danger');
    } finally {
      setAdding(false);
    }
  };

  const copy = (text: string) => {
    const done = () => showToast('Copied.', 'success');
    const blocked = () => showToast('Copying was blocked by the browser. Select the text and copy it instead.', 'warning');
    try {
      void navigator.clipboard.writeText(text).then(done, blocked);
    } catch {
      blocked();
    }
  };

  return (
    <div className="space-y-3" data-testid="gm-board-step-scenes">
      <SceneHeader
        key={scene.id}
        model={model}
        slots={slots}
        locations={locations}
        placeName={placeName}
        onGo={go}
        onChange={(fields) => edit((s) => ({ ...s, ...fields }))}
        onDelete={deleteScene}
      />
      <SceneCast
        model={model}
        onJoin={join}
        onLeave={leave}
        onEffects={edit}
        onRemoveEffect={(i) => {
          const before = scene;
          edit((s) => removeEffect(s, i));
          showToast('Effect removed.', 'info', { action: { label: 'Undo', onClick: () => put(before) } });
        }}
      />
      <SceneRewards scene={scene} board={board} names={model.names} canRead={canRead} sceneName={sceneName(scene, model.names)} />

      <div className="grid items-start gap-4" style={{ gridTemplateColumns: view === 'side' ? 'minmax(16rem, 1fr) minmax(0, 2.4fr)' : 'minmax(16rem, 1fr) minmax(0, 1.6fr) minmax(16rem, 1fr)' }}>
        <div className="sticky top-4 max-h-[calc(100vh-2rem)] overflow-y-auto">
          <SceneReference
            key={scene.id}
            model={model}
            plans={{
              location: settings?.codex.find((e) => e.id === scene.locationId),
              placeName,
              slotName,
              onSetOutcome: (card, outcome) => cardActions.change(card, { outcome }),
              onTrigger: trigger,
              onMomentFromCard: momentFromCard,
              onJoin: join,
            }}
            submissions={submissions}
            sheetItems={sheetItems}
            codex={codex}
            characters={characters}
            onInsert={insert}
            onMomentFromPassage={(characterId, quote) => addMomentAfter(null, { ref: { characterId, quote } })}
          />
        </div>

        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex gap-1" role="group" aria-label="Scene view">
              <Button type="button" size="sm" variant={view === 'moments' ? 'primary' : 'secondary'} aria-pressed={view === 'moments'} onClick={() => setView('moments')}>
                Moments
              </Button>
              <Button type="button" size="sm" variant={view === 'side' ? 'primary' : 'secondary'} aria-pressed={view === 'side'} onClick={() => setView('side')}>
                Side by side
              </Button>
            </div>
            <span className="text-xs text-content-tertiary">Ctrl+Enter in a moment adds one below.</span>
          </div>

          {view === 'side' ? (
            <SceneSideBySide
              model={model}
              onPick={(momentId, characterId) => {
                setView('moments');
                setReader(characterId);
                setFocusedId(momentId);
                setAutoFocusId(momentId);
              }}
            />
          ) : (
            <>
              <details className="text-sm" open={scene.moments.length <= 1 && !scene.moments[0]?.text.trim()}>
                <summary className="cursor-pointer text-content-secondary">How moments work</summary>
                <p className="mt-1 text-content-secondary">
                  A moment is one thing that happens. Write it once, with names, then tick who reads it: each person ticked gets it with their own
                  name turned into “you”. ✎ beside a name gives that person their own version, such as what it feels like to be hit. Untick everyone
                  and the moment is a private GM note. People in the same room don’t need separate scenes: keep one scene and untick whoever
                  doesn’t notice a moment.
                </p>
              </details>
              {scene.moments.map((m, i) => (
                <div key={m.id} className="space-y-1">
                  {i > 0 && (
                    <div className="flex justify-center">
                      <Button type="button" size="sm" variant="ghost" className="!py-0 text-xs" aria-label={`Insert a moment before moment ${i + 1}`} onClick={() => addMomentAfter(scene.moments[i - 1].id)}>
                        + moment
                      </Button>
                    </div>
                  )}
                  <MomentEditor moment={m} index={i} model={model} actions={momentActions} focused={focusedId === m.id} autoFocus={autoFocusId === m.id} />
                </div>
              ))}
              {!scene.moments.length && <p className="text-sm text-content-secondary">No moments yet.</p>}
              <Button type="button" size="sm" variant="primary" onClick={() => addMomentAfter(scene.moments[scene.moments.length - 1]?.id ?? null)}>
                + Moment
              </Button>
            </>
          )}
        </div>

        {view === 'moments' && (
          <div className="sticky top-4 max-h-[calc(100vh-2rem)] overflow-y-auto">
            <SceneReadsAs
              model={model}
              reader={reader}
              onReader={setReader}
              focusedId={focusedId}
              onFocusMoment={(id) => {
                setFocusedId(id);
                document.getElementById(`moment-${id}`)?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
              }}
              onCopy={copy}
              inDraft={inDraft}
              onAddToDraft={(id, moments, text) => void addToDraft(id, moments, text)}
              adding={adding}
              onWrite={onWrite}
            />
          </div>
        )}
      </div>
    </div>
  );
}
