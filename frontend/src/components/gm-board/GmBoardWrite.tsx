import { useCallback, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Badge, Button, Card, CardBody, Spinner } from '@/components/ui';
import { PublishAllResultsDialog } from '@/components/actions/PublishAllResultsDialog';
import { useToast } from '@/contexts/ToastContext';
import { useGameActionResults, usePublishAllPhaseResults } from '@/hooks/useActionResults';
import { useBoardPeople } from '@/hooks/useBoardPeople';
import { useGameCharacterSheetItems } from '@/hooks/useCharacterSheetItems';
import { useGmBoardStore } from '@/hooks/useGmBoard';
import { useRewriteDraft } from '@/hooks/useResultDraft';
import { apiClient } from '@/lib/api';
import { publishChecks } from '@/lib/gmBoard/checks';
import { coverageFor, isCovered, setCovered } from '@/lib/gmBoard/coverage';
import { computeFlags } from '@/lib/gmBoard/flags';
import { leaksFor } from '@/lib/gmBoard/leaks';
import { boardRows, NO_LOCATION } from '@/lib/gmBoard/map';
import { nextNotDone, setReady } from '@/lib/gmBoard/progress';
import { lineText } from '@/lib/gmBoard/rewards';
import { withBlock } from '@/lib/gmBoard/rewardState';
import { chainsFor, characterIdsWithResults, draftTexts, resultStatus, writeList } from '@/lib/gmBoard/results';
import { sceneName } from '@/lib/gmBoard/scenes';
import { shortName, truncate } from '@/lib/gmBoard/text';
import type { BoardDoc, CharacterProgress, Moment } from '@/lib/gmBoard/types';
import { youifyExcept } from '@/lib/gmBoard/youify';
import type { GamePhase } from '@/types/phases';
import { useOptionalBoardRewards } from './boardRewards';
import { RewardsTable } from './RewardsTable';
import { WriteBrief } from './WriteBrief';
import { WriteChecks } from './WriteChecks';
import { WritePlayerList, type WritePlayer } from './WritePlayerList';
import { WriteResults } from './WriteResults';
import { WriteRewards } from './WriteRewards';
import type { WriteModel } from './writeTypes';

interface GmBoardWriteProps {
  gameId: number;
  phase: GamePhase;
  board: BoardDoc;
  /** characterId → the result part last picked, kept by the board across steps. */
  selectedParts: Record<number, number | null>;
  onSelectPart: (characterId: number, partId: number | null) => void;
  onOpenScene: (sceneId: string) => void;
}

/**
 * The Write step: one character at a time (`?who=`). On the left, everyone
 * who gets a result; in the middle, the character's brief; on the right,
 * their results with the draft, and the checks before publishing.
 */
export function GmBoardWrite({ gameId, phase, board, selectedParts, onSelectPart, onOpenScene }: GmBoardWriteProps) {
  const [params, setParams] = useSearchParams();
  const { showToast, showError } = useToast();
  const rewards = useOptionalBoardRewards();
  const rewriteDraft = useRewriteDraft(gameId);
  const [putting, setPutting] = useState(false);
  const store = useGmBoardStore(gameId, phase.id);
  const people = useBoardPeople(gameId, phase.id);
  const { cast, names, nameLists, submissions, submissionIds, settings } = people;
  const sheetItems = useGameCharacterSheetItems(gameId);
  const results = useGameActionResults(gameId);
  const publishAll = usePublishAllPhaseResults(gameId, phase.id);
  const [publishAllOpen, setPublishAllOpen] = useState(false);
  const unpublished = useQuery({
    queryKey: ['unpublishedResultsCount', gameId, phase.id],
    queryFn: () => apiClient.phases.getUnpublishedResultsCount(gameId, phase.id).then((res) => res.data),
    enabled: gameId > 0,
  });

  const insertTextRef = useRef<((text: string) => void) | null>(null);
  const transformTextRef = useRef<((fn: (text: string) => string) => void) | null>(null);
  const flushRef = useRef<(() => Promise<void>) | null>(null);
  const rewriteRef = useRef<((fn: (text: string) => string) => void) | null>(null);
  const [live, setLive] = useState<{ characterId: number; partId: number | null; text: string } | null>(null);
  const [editable, setEditable] = useState(false);

  const secondPerson = settings?.secondPerson ?? true;
  const phaseResults = useMemo(() => (results.data ?? []).filter((r) => r.phase_id === phase.id), [results.data, phase.id]);
  const castById = useMemo(() => new Map(cast.map((c) => [c.id, c])), [cast]);
  const order = useMemo(
    () => writeList(cast.filter((c) => c.reads).map((c) => c.id), characterIdsWithResults(phaseResults, phase.id)),
    [cast, phaseResults, phase.id],
  );
  const wanted = Number(params.get('who'));
  const current = order.includes(wanted) ? wanted : (order[0] ?? null);

  const rows = useMemo(() => boardRows(settings?.codex ?? [], phase.id, board.cards), [settings?.codex, phase.id, board.cards]);
  const allNames = useMemo(() => {
    const m = new Map(names);
    for (const id of order) if (!m.has(id)) m.set(id, phaseResults.find((r) => r.character_id === id)?.character_name || `Character ${id}`);
    return m;
  }, [names, order, phaseResults]);
  const model = useMemo<WriteModel>(
    () => ({
      board,
      names: allNames,
      nameLists,
      cast: castById,
      secondPerson,
      placeName: (id) => rows.find((r) => r.id === id && r.id !== NO_LOCATION)?.name ?? 'No location',
      slotName: (id) => (id === null ? 'Contingencies' : (board.chunks.find((c) => c.id === id)?.name ?? 'a deleted time slot')),
      sceneName: (scene) => sceneName(scene, allNames),
    }),
    [board, allNames, nameLists, castById, secondPerson, rows],
  );

  const flags = useMemo(() => computeFlags(board), [board]);
  const reader = useCallback((id: number) => ({ names: nameLists.get(id) ?? [], secondPerson }), [nameLists, secondPerson]);

  // Each character's drafts, with the text being typed in place of its saved copy.
  const draftsFor = useCallback(
    (id: number) => {
      const chains = chainsFor(phaseResults, phase.id, id);
      if (!live || live.characterId !== id) return { chains, drafts: draftTexts(chains) };
      const known = live.partId !== null && chains.some((c) => c.parts.some((p) => p.id === live.partId));
      const drafts = draftTexts(chains, known ? new Map([[live.partId as number, live.text]]) : undefined);
      return { chains, drafts: known ? drafts : [...drafts, live.text] };
    },
    [phaseResults, phase.id, live],
  );

  const players = useMemo<WritePlayer[]>(
    () =>
      order.map((id) => {
        const { chains, drafts } = draftsFor(id);
        const cov = coverageFor(board, id, drafts, reader(id));
        const leaks = leaksFor({ characterId: id, phaseId: phase.id, drafts, board, codex: settings?.codex ?? [], sheetItems });
        return {
          id,
          name: shortName(allNames.get(id) ?? `Character ${id}`),
          avatarUrl: castById.get(id)?.avatarUrl,
          status: resultStatus(chains, !!board.ready[id]),
          covered: cov.done,
          moments: cov.total,
          leaks: leaks.length,
        };
      }),
    [order, draftsFor, board, reader, phase.id, settings?.codex, sheetItems, allNames, castById],
  );

  const onLiveText = useCallback(
    (partId: number | null, text: string) => {
      if (current === null) return;
      setLive((prev) => (prev && prev.characterId === current && prev.partId === partId && prev.text === text ? prev : { characterId: current, partId, text }));
    },
    [current],
  );
  const selectPart = useCallback((partId: number | null) => current !== null && onSelectPart(current, partId), [current, onSelectPart]);

  if (people.isLoading || results.isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner size="lg" />
      </div>
    );
  }

  if (current === null) {
    return (
      <Card variant="bordered" padding="md" data-testid="gm-board-step-write">
        <CardBody>
          <p className="text-content-primary">Nobody to write a result for yet.</p>
          <p className="mt-1 text-sm text-content-secondary">Results go to approved characters someone plays, including NPCs assigned to a player.</p>
        </CardBody>
      </Card>
    );
  }

  const name = shortName(allNames.get(current) ?? `Character ${current}`);
  const { chains, drafts } = draftsFor(current);
  const ticks = board.covered[current];
  const covered = (m: Moment) => isCovered(m, current, drafts, ticks, reader(current));
  const coverage = coverageFor(board, current, drafts, reader(current));
  const checks = publishChecks({ characterId: current, phaseId: phase.id, drafts, board, codex: settings?.codex ?? [], sheetItems, reader: reader(current), flags });
  const ready = !!board.ready[current];
  const rewardBase = rewards?.stateFor(current);
  const tailId = rewardBase?.carrier.tail?.id;
  const editorOnTail = live?.characterId === current && tailId !== undefined && live.partId === tailId;
  const reward = rewards && editorOnTail ? rewards.stateFor(current, live.text) : rewardBase;
  const view = params.get('view') === 'table' ? 'table' : 'results';
  const setView = (next: 'table' | 'results', who?: number) => {
    const p = new URLSearchParams(params);
    if (next === 'table') p.set('view', 'table');
    else p.delete('view');
    if (who !== undefined) p.set('who', String(who));
    setParams(p);
  };

  const putBlock = async () => {
    const tail = reward?.carrier.tail;
    if (!rewards || !reward || !tail || !reward.block.text) return;
    const text = reward.block.text;
    const previous = reward.rewards.block;
    setPutting(true);
    try {
      if (editorOnTail && rewriteRef.current) rewriteRef.current((t) => withBlock(t, text, previous));
      else {
        await flushRef.current?.();
        await rewriteDraft(tail, (t) => withBlock(t, text, previous));
      }
      rewards.updateRewards(current, (r) => ({ ...r, block: text }));
      showToast('Block put in the result.', 'success');
    } catch {
      showError('Couldn’t put the block in the result. Try again.');
    } finally {
      setPutting(false);
    }
  };
  const beforePublish = async () => {
    try {
      await rewards?.ensureSynced(current);
    } catch {
      showError('Couldn’t save the reward sheet updates before publishing. Try again.');
      throw new Error('reward sync failed');
    }
  };

  const tick = (momentId: string, on: boolean) => store.update<CharacterProgress>('progress', String(current), (p) => setCovered(p, momentId, on));

  const choose = async (id: number) => {
    await flushRef.current?.();
    const next = new URLSearchParams(params);
    next.set('who', String(id));
    setParams(next);
  };

  const readyNext = async () => {
    await flushRef.current?.();
    store.update<CharacterProgress>('progress', String(current), (p) => setReady(p, true));
    const next = nextNotDone(order, { ...board.ready, [current]: true }, current);
    if (next === null) showToast('Everyone is ready. Publish when you’re happy.', 'success');
    else void choose(next);
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

  const makeYou = () => {
    const own = board.scenes.flatMap((s) => s.moments.map((m) => m.ownText[current] ?? '')).filter((t) => t.trim());
    transformTextRef.current?.((t) => youifyExcept(t, nameLists.get(current) ?? [], own));
  };

  const count = unpublished.data?.count ?? 0;

  return (
    <div className="space-y-3" data-testid="gm-board-step-write">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <span className="text-sm text-content-secondary">
          {count} draft {count === 1 ? 'result' : 'results'} in this phase
        </span>
        <Button
          type="button"
          variant="primary"
          disabled={count === 0 || publishAll.isPending}
          onClick={async () => {
            await flushRef.current?.();
            try {
              await Promise.all(order.map((id) => rewards?.ensureSynced(id)));
            } catch {
              showError('Couldn’t save the reward sheet updates before publishing. Try again.');
              return;
            }
            setPublishAllOpen(true);
          }}
        >
          Publish all
        </Button>
      </div>

      {view === 'table' && rewards ? (
        <RewardsTable
          characterIds={order}
          name={(id) => shortName(allNames.get(id) ?? `Character ${id}`)}
          stateFor={(id) => rewards.stateFor(id)}
          onOpen={(id) => setView('results', id)}
          onBack={() => setView('results')}
        />
      ) : (
        <div className="grid grid-cols-[12rem_minmax(0,1fr)_minmax(0,1.15fr)] items-start gap-4">
          <WritePlayerList players={players} selectedId={current} onSelect={(id) => void choose(id)} />

          <Card variant="bordered" padding="md">
            <CardBody>
              <WriteBrief
                key={current}
                model={model}
                characterId={current}
                others={order}
                submission={submissions.get(current)}
                isCovered={covered}
                coverage={coverage}
                onCovered={tick}
                onInsert={
                  editable
                    ? (m, text) => {
                        insertTextRef.current?.(text);
                        tick(m.id, true);
                      }
                    : undefined
                }
                onCopy={copy}
                onOpenScene={onOpenScene}
              />
            </CardBody>
          </Card>

          <div className="sticky top-4 max-h-[calc(100vh-2rem)] space-y-4 overflow-y-auto">
            <Card variant="bordered" padding="md">
              <CardBody className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-base font-semibold text-content-primary">Results for {allNames.get(current)}</h3>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={!editable}
                      onClick={makeYou}
                      title={`Swap ${name}’s names for “you” in the selected text, or the whole draft when nothing is selected. Own versions stay as written.`}
                    >
                      Make “you”
                    </Button>
                    {ready ? (
                      <>
                        <Badge variant="success">Ready</Badge>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => store.update<CharacterProgress>('progress', String(current), (p) => setReady(p, false))}
                        >
                          Reopen
                        </Button>
                      </>
                    ) : (
                      <Button type="button" size="sm" variant="primary" onClick={() => void readyNext()} title={`Mark ${name} ready and open the next person`}>
                        Ready → next
                      </Button>
                    )}
                  </div>
                </div>
                <WriteResults
                  key={current}
                  gameId={gameId}
                  characterId={current}
                  characterName={allNames.get(current) ?? name}
                  name={name}
                  userId={castById.get(current)?.userId}
                  submissionId={submissionIds.get(current)}
                  chains={chains}
                  phaseResults={phaseResults}
                  selectedPartId={selectedParts[current] ?? null}
                  onSelectPart={selectPart}
                  onLiveText={onLiveText}
                  onEditable={setEditable}
                  insertTextRef={insertTextRef}
                  transformTextRef={transformTextRef}
                  flushRef={flushRef}
                  rewriteRef={rewriteRef}
                  beforePublish={beforePublish}
                  sheetItems={sheetItems.get(current)}
                />
              </CardBody>
            </Card>
            {rewards && reward && (
              <Card variant="bordered" padding="md">
                <CardBody>
                  <WriteRewards
                    key={current}
                    gameId={gameId}
                    characterId={current}
                    name={name}
                    fullName={allNames.get(current) ?? name}
                    state={reward}
                    chains={chains}
                    sceneName={(id) => {
                      const scene = board.scenes.find((sc) => sc.id === id);
                      return scene ? model.sceneName(scene) : undefined;
                    }}
                    onPutBlock={() => void putBlock()}
                    putting={putting}
                    onCopy={copy}
                    onShowTable={() => setView('table')}
                  />
                </CardBody>
              </Card>
            )}
            <Card variant="bordered" padding="md">
              <CardBody>
                <WriteChecks
                  model={model}
                  characterId={current}
                  checks={checks}
                  rows={rows}
                  onOpenScene={onOpenScene}
                  onDismissFlag={(key) => {
                    store.update('flag', key, () => ({}));
                    showToast('Check dismissed.', 'info', { action: { label: 'Undo', onClick: () => store.remove('flag', key) } });
                  }}
                  rewardChecks={reward?.checks}
                  lineLabel={(lineId) => {
                    const line = reward?.lines.find((l) => l.id === lineId);
                    return line ? truncate(lineText(line, reward?.sheet.recs[lineId]) || 'A sheet-only line', 50) : 'A line';
                  }}
                  onPutBlock={() => void putBlock()}
                />
              </CardBody>
            </Card>
          </div>
        </div>
      )}

      <PublishAllResultsDialog
        isOpen={publishAllOpen}
        onClose={() => setPublishAllOpen(false)}
        onConfirm={() => publishAll.mutate(undefined, { onSuccess: () => setPublishAllOpen(false) })}
        gameId={gameId}
        phaseId={phase.id}
        count={count}
        isPublishing={publishAll.isPending}
      />
    </div>
  );
}
