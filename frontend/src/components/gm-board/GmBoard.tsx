import { useCallback, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { Alert, Badge, Button, Modal, Spinner, Textarea } from '@/components/ui';
import { useToast } from '@/contexts/ToastContext';
import { useGameContext } from '@/contexts/GameContext';
import { BoardReadOnlyContext, BoardUnsavedTextContext } from '@/hooks/useBoardReadOnly';
import { useGmBoard, useGmBoardStore, useGmSettings, useGmSettingsStore, type GmSaveStatus } from '@/hooks/useGmBoard';
import { usePhaseRewards } from '@/hooks/usePhaseRewards';
import { apiClient } from '@/lib/api';
import { boardCast } from '@/lib/gmBoard/cast';
import { codexDoc } from '@/lib/gmBoard/codex';
import { NOTES_KEY } from '@/lib/gmBoard/store';
import { boardSetupPath, parseBoardStep, resultsAreaPath } from '@/lib/gmBoard/steps';
import type { GamePhase } from '@/types/phases';
import { BoardRewardsContext } from './boardRewards';
import { BoardStepTabs } from './BoardStepTabs';
import { BoardToolbarSlotContext } from './boardToolbarSlot';
import { CodexAddForm } from './CodexAddForm';
import { GmBoardConflicts } from './GmBoardConflicts';
import { GmBoardFirstRun } from './GmBoardFirstRun';
import { GmBoardMap } from './GmBoardMap';
import { GmBoardNotes } from './GmBoardNotes';
import { GmBoardRead } from './GmBoardRead';
import { GmBoardScenes } from './GmBoardScenes';
import { GmBoardWrite } from './GmBoardWrite';
import { GmBoardSaveStatus } from './GmBoardSaveStatus';
import { GmCodexManager } from './GmCodexManager';

interface GmBoardProps {
  gameId: number;
  gameTitle: string;
  phase: GamePhase;
  /** No editing controls, nothing saved: a viewer, or the GM of an archived game. */
  readOnly?: boolean;
  /** The game is completed or cancelled. */
  archived?: boolean;
  /** This phase has run and is over, so its board is read-only until it's activated again. */
  phaseEnded?: boolean;
  /** Not a GM: someone the GM shares the board with. */
  viewer?: boolean;
  /** Where the header's link goes back to: the GM's results area unless given. */
  back?: { to: string; label: string };
}

const SAVE_RANK: Record<GmSaveStatus, number> = { saved: 0, unsaved: 1, saving: 2, error: 3 };
/** The board and the game settings save separately; the header shows whichever is further from saved. */
const worse = (a: GmSaveStatus, b: GmSaveStatus) => (SAVE_RANK[b] > SAVE_RANK[a] ? b : a);

/** A refused read: the GM stopped sharing while a viewer had the board open. */
const isRefused = (error: unknown) => isAxiosError(error) && error.response?.status === 403;

/**
 * The GM results board for one action phase: the Read → Map → Scenes → Write
 * steps, then the Codex and Notes tabs, with the tab in the URL (`?step=`).
 * Which result part the GM last picked for each character lives here, so
 * Write keeps it across tabs.
 */
export function GmBoard({ gameId, gameTitle, phase, readOnly = false, viewer = false, archived = false, phaseEnded = false, back: backTo }: GmBoardProps) {
  const back = backTo ?? { to: resultsAreaPath(gameId), label: 'Back to the results' };
  const navigate = useNavigate();
  const location = useLocation();
  // Game setup, remembering where on the board the GM was, so they can come straight back.
  const openSetup = () => navigate(boardSetupPath(gameId, location.pathname + location.search));
  const [params, setParams] = useSearchParams();
  const step = parseBoardStep(params.get('step'));
  const [toolbarSlot, setToolbarSlot] = useState<HTMLDivElement | null>(null);
  // + Codex on text selected in Read: a quick add in a dialog, so the GM stays on the submission.
  const [quickCodex, setQuickCodex] = useState<string | null>(null);
  const { showToast } = useToast();
  // Text a result editor couldn't save before it closed, because the phase ended.
  const [unsavedTexts, setUnsavedTexts] = useState<{ label: string; text: string }[]>([]);
  const keepUnsavedText = useCallback((label: string, text: string) => setUnsavedTexts((list) => [...list, { label, text }]), []);
  const [selectedParts, setSelectedParts] = useState<Record<number, number | null>>({});
  const selectPart = useCallback((characterId: number, partId: number | null) => setSelectedParts((s) => ({ ...s, [characterId]: partId })), []);
  const { allGameCharacters } = useGameContext();
  const players = useMemo(() => boardCast(allGameCharacters).filter((c) => !c.npc), [allGameCharacters]);
  const phases = useQuery({
    queryKey: ['gamePhases', gameId],
    queryFn: () => apiClient.phases.getGamePhases(gameId).then((res) => res.data),
    enabled: gameId > 0,
  });
  const actionPhases = useMemo(
    () =>
      (phases.data ?? [])
        .filter((p) => p.phase_type === 'action')
        .map((p) => ({ id: p.id, title: p.title || `Phase ${p.phase_number}` })),
    [phases.data],
  );

  const showEndedNotice = phaseEnded && !viewer && !archived;
  const unpublished = useQuery({
    queryKey: ['unpublishedResultsCount', gameId, phase.id],
    queryFn: () => apiClient.phases.getUnpublishedResultsCount(gameId, phase.id).then((res) => res.data),
    enabled: showEndedNotice,
  });
  const unpublishedCount = unpublished.data?.count ?? 0;

  const { board, isLoading, error } = useGmBoard(gameId, phase.id);
  const { settings, error: settingsError } = useGmSettings(gameId);
  // This component is above its own BoardReadOnlyContext, so the hooks here are told directly.
  const store = useGmBoardStore(gameId, phase.id, { readOnly });
  // Game settings edited from the board: the codex panel and the notes for every phase.
  const settingsStore = useGmSettingsStore(gameId, { readOnly });
  const saveStatus = worse(store.status, settingsStore.status);
  // Mounted for the whole board, so sheet drafts follow the lines from any step.
  const rewards = usePhaseRewards(gameId, phase.id, board, { readOnly });

  const goToStep = (next: string) => {
    const nextParams = new URLSearchParams(params);
    if (next === 'read') nextParams.delete('step');
    else nextParams.set('step', next);
    setParams(nextParams);
  };

  /** The Codex tab, or with a name (text selected in Read) the quick-add dialog. */
  const openCodex = (name?: string) => {
    if (name) setQuickCodex(name);
    else {
      goToStep('codex');
      window.scrollTo?.(0, 0);
    }
  };

  const readSubmission = (characterId: number) => {
    const nextParams = new URLSearchParams(params);
    nextParams.delete('step');
    nextParams.set('who', String(characterId));
    setParams(nextParams);
    window.scrollTo?.(0, 0);
  };

  const openScene = (sceneId: string) => {
    const nextParams = new URLSearchParams(params);
    nextParams.set('step', 'scenes');
    nextParams.set('scene', sceneId);
    setParams(nextParams);
    window.scrollTo?.(0, 0);
  };

  if (viewer && (isRefused(error) || isRefused(settingsError))) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8" data-testid="gm-board-not-shared">
        <Alert variant="info" title="This board is no longer shared">
          <p>The GM has stopped sharing this game’s results boards.</p>
          <p className="mt-2">
            <Link to={back.to} className="underline">
              {back.label}
            </Link>
          </p>
        </Alert>
      </div>
    );
  }

  const readOnlyNote = viewer
    ? archived
      ? 'Shared by the GM. This game is over, so the board won’t change.'
      : phaseEnded
        ? 'Shared by the GM. This phase has ended.'
        : 'Shared by the GM. It updates as the GM works.'
    : showEndedNotice
      ? null // The notice below the header says it, with what to do.
      : 'This game is archived, so its boards can no longer be changed.';

  return (
    <BoardReadOnlyContext.Provider value={readOnly}>
    <BoardUnsavedTextContext.Provider value={keepUnsavedText}>
    <BoardRewardsContext.Provider value={rewards}>
      <div className="px-6 py-4 space-y-4" data-testid="gm-board">
        <header className="rounded-lg border border-theme-strong surface-base shadow-sm">
          {/* Below xl the title takes its own short line, so the tabs and actions keep their room without truncating it. */}
          <div className="flex flex-wrap items-stretch gap-x-4 px-4 xl:flex-nowrap">
            <div className="flex min-w-0 basis-full items-baseline gap-3 self-center pt-2 xl:block xl:flex-1 xl:basis-auto xl:py-2">
              <p className="min-w-0 shrink truncate text-xs text-content-tertiary xl:shrink-0">
                <Link to={back.to} className="hover:underline">
                  &larr; {gameTitle}: {back.label.replace(/^Back to the /, '')}
                </Link>
                {readOnly && readOnlyNote && (
                  <>
                    {' · '}
                    <span>{readOnlyNote}</span>
                  </>
                )}
              </p>
              <h1 className="order-first flex min-w-0 shrink-0 items-center gap-2 text-base font-semibold text-content-primary xl:order-none">
                <span className="min-w-0 truncate">
                  <span className="sr-only font-normal text-content-secondary xl:not-sr-only xl:whitespace-nowrap">Results board · </span>
                  {phase.title || `Phase ${phase.phase_number}`}
                </span>
                {readOnly && (
                  <Badge variant="neutral" className="shrink-0" data-testid="gm-board-read-only">
                    Read-only
                  </Badge>
                )}
              </h1>
            </div>
            <div className="flex shrink-0 items-end">
              <BoardStepTabs gameId={gameId} phaseId={phase.id} board={board ?? null} step={step} onStep={goToStep} />
            </div>
            <span className="flex-1 xl:hidden" />
            <div className="flex shrink-0 items-center gap-1.5 py-2">
              {!readOnly && (
                <GmBoardSaveStatus
                  status={saveStatus}
                  error={store.saveError ?? settingsStore.saveError}
                  onRetry={() => {
                    void store.flush();
                    void settingsStore.flush();
                  }}
                />
              )}
              <Button type="button" size="sm" variant="ghost" onClick={openSetup}>
                Game setup
              </Button>
            </div>
          </div>
          {/* The open step's toolbar (BoardToolbar) is portalled in here, so it reads as part of the header. */}
          <div ref={setToolbarSlot} className="rounded-b-lg border-t border-theme-default surface-sunken px-4 py-2 empty:hidden" data-testid="gm-board-step-toolbar" />
        </header>

        {showEndedNotice && (
          <Alert variant="info" title="This phase has ended" data-testid="gm-board-ended">
            <p>
              Its board is read-only, and its results stay as they are
              {unpublishedCount > 0 && (
                <>
                  , including {unpublishedCount} unpublished {unpublishedCount === 1 ? 'result' : 'results'}
                </>
              )}
              . To keep working on it, activate it again from{' '}
              <Link to={`/games/${gameId}?tab=phases`} className="underline">
                Phases
              </Link>
              .
            </p>
          </Alert>
        )}

        {unsavedTexts.length > 0 && (
          <Alert variant="warning" title="Text that couldn’t be saved" dismissible onDismiss={() => setUnsavedTexts([])} data-testid="gm-board-unsaved-text">
            <p>This phase stopped being active before this was saved. Copy anything you want to keep; it goes away when you leave the board.</p>
            {unsavedTexts.map((u, i) => (
              <Textarea key={i} id={`gm-board-unsaved-${i}`} label={u.label} value={u.text} readOnly rows={4} className="mt-2" />
            ))}
          </Alert>
        )}

        {!readOnly && <GmBoardConflicts lost={store.lost} onKeepMine={store.keepMine} onDismiss={store.dismissLost} />}
        {!readOnly && (
          <GmBoardConflicts
            lost={settingsStore.lost}
            onKeepMine={settingsStore.keepMine}
            onDismiss={settingsStore.dismissLost}
            kindNames={{ notes: 'the notes for every phase' }}
          />
        )}
        {!readOnly && board && (
          <GmBoardFirstRun gameId={gameId} phaseId={phase.id} board={board} onAddLocations={() => goToStep('map')} onOpenSetup={openSetup} />
        )}

        <BoardToolbarSlotContext.Provider value={toolbarSlot}>
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Spinner size="lg" />
          </div>
        ) : error || !board ? (
          <Alert variant="danger" title="The board didn’t load">
            Try reloading the page.
          </Alert>
        ) : step === 'read' ? (
          <GmBoardRead
            gameId={gameId}
            phase={phase}
            board={board}
            onOpenCodex={openCodex}
            onGoToMap={() => goToStep('map')}
          />
        ) : step === 'map' ? (
          <GmBoardMap
            gameId={gameId}
            phase={phase}
            phases={actionPhases}
            board={board}
            onOpenCodex={openCodex}
            onReadSubmission={readSubmission}
            onOpenScene={openScene}
          />
        ) : step === 'scenes' ? (
          <GmBoardScenes
            gameId={gameId}
            phase={phase}
            board={board}
            onGoToMap={() => goToStep('map')}
            onReadSubmission={readSubmission}
          />
        ) : step === 'write' ? (
          <GmBoardWrite gameId={gameId} phase={phase} board={board} selectedParts={selectedParts} onSelectPart={selectPart} onOpenScene={openScene} />
        ) : step === 'codex' ? (
          <div className="mx-auto max-w-4xl" data-testid="gm-board-step-codex">
            <GmCodexManager gameId={gameId} phases={actionPhases} players={players} phaseId={phase.id} />
          </div>
        ) : (
          <GmBoardNotes
            phaseTitle={phase.title || `Phase ${phase.phase_number}`}
            notes={board.notes}
            onChange={(text) => store.update('notes', NOTES_KEY, () => ({ text }))}
            gameNotes={settings?.notes ?? ''}
            onGameChange={(text) => settingsStore.update('notes', NOTES_KEY, () => ({ text }))}
            readOnly={readOnly}
          />
        )}
        </BoardToolbarSlotContext.Provider>

        {quickCodex !== null && (
          <Modal isOpen onClose={() => setQuickCodex(null)} title="Add to the codex" size="lg">
            <CodexAddForm
              phases={actionPhases}
              phaseId={phase.id}
              initialName={quickCodex}
              onAdd={(entry) => {
                settingsStore.update('codex', entry.id, () => codexDoc(entry));
                setQuickCodex(null);
                showToast(`Added “${entry.name}” to the codex.`, 'success', { action: { label: 'Open the codex', onClick: () => openCodex() } });
              }}
            />
          </Modal>
        )}

      </div>
    </BoardRewardsContext.Provider>
    </BoardUnsavedTextContext.Provider>
    </BoardReadOnlyContext.Provider>
  );
}
