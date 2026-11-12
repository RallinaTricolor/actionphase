import { useCallback, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { Alert, Badge, Button, Drawer, Spinner } from '@/components/ui';
import { useGameContext } from '@/contexts/GameContext';
import { BoardReadOnlyContext } from '@/hooks/useBoardReadOnly';
import { useGmBoard, useGmBoardStore, useGmSettings, useGmSettingsStore, type GmSaveStatus } from '@/hooks/useGmBoard';
import { usePhaseRewards } from '@/hooks/usePhaseRewards';
import { apiClient } from '@/lib/api';
import { boardCast } from '@/lib/gmBoard/cast';
import { NOTES_KEY } from '@/lib/gmBoard/store';
import { boardSetupPath, parseBoardStep, resultsAreaPath } from '@/lib/gmBoard/steps';
import type { GamePhase } from '@/types/phases';
import { BoardRewardsContext } from './boardRewards';
import { BoardStepTabs } from './BoardStepTabs';
import { BoardToolbarSlotContext } from './boardToolbarSlot';
import { GmBoardConflicts } from './GmBoardConflicts';
import { GmBoardFirstRun } from './GmBoardFirstRun';
import { GmBoardMap } from './GmBoardMap';
import { GmBoardNotesDrawer } from './GmBoardNotesDrawer';
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
 * steps, with the step in the URL (`?step=`). Which result part the GM last
 * picked for each character lives here, so Scenes' "Add to draft" and Write
 * agree on it.
 */
export function GmBoard({ gameId, gameTitle, phase, readOnly = false, viewer = false, back: backTo }: GmBoardProps) {
  const back = backTo ?? { to: resultsAreaPath(gameId), label: 'Back to the results' };
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const step = parseBoardStep(params.get('step'));
  const [notesOpen, setNotesOpen] = useState(false);
  const [toolbarSlot, setToolbarSlot] = useState<HTMLDivElement | null>(null);
  const [codex, setCodex] = useState<{ name: string } | null>(null);
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

  const { board, isLoading, error } = useGmBoard(gameId, phase.id);
  const { settings, error: settingsError } = useGmSettings(gameId);
  // This component is above its own BoardReadOnlyContext, so the hooks here are told directly.
  const store = useGmBoardStore(gameId, phase.id, { readOnly });
  // Game settings edited from the board: the codex drawer and the notes for every phase.
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

  const writeFor = (characterId: number) => {
    const nextParams = new URLSearchParams(params);
    nextParams.set('step', 'write');
    nextParams.set('who', String(characterId));
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

  return (
    <BoardReadOnlyContext.Provider value={readOnly}>
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
                {readOnly && (
                  <>
                    {' · '}
                    <span>{viewer ? 'Shared by the GM. It updates as the GM works.' : 'This game is archived, so its boards can no longer be changed.'}</span>
                  </>
                )}
              </p>
              <h1 className="order-first flex shrink-0 items-center gap-2 text-base font-semibold text-content-primary xl:order-none">
                <span className="truncate">
                  <span className="sr-only font-normal text-content-secondary xl:not-sr-only">Results board · </span>
                  {phase.title || `Phase ${phase.phase_number}`}
                </span>
                {readOnly && (
                  <Badge variant="neutral" data-testid="gm-board-read-only">
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
              <Button type="button" size="sm" variant="secondary" onClick={() => setCodex({ name: '' })}>
                Codex
              </Button>
              <Button type="button" size="sm" variant="secondary" onClick={() => setNotesOpen(true)} disabled={!board}>
                Notes
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => navigate(boardSetupPath(gameId))}>
                Game setup
              </Button>
            </div>
          </div>
          {/* The open step's toolbar (BoardToolbar) is portalled in here, so it reads as part of the header. */}
          <div ref={setToolbarSlot} className="rounded-b-lg border-t border-theme-default surface-sunken px-4 py-2 empty:hidden" data-testid="gm-board-step-toolbar" />
        </header>

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
          <GmBoardFirstRun gameId={gameId} phaseId={phase.id} board={board} onOpenCodex={() => setCodex({ name: '' })} onOpenSetup={() => navigate(boardSetupPath(gameId))} />
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
            onOpenCodex={(name = '') => setCodex({ name })}
            onGoToMap={() => goToStep('map')}
          />
        ) : step === 'map' ? (
          <GmBoardMap
            gameId={gameId}
            phase={phase}
            board={board}
            onOpenCodex={(name = '') => setCodex({ name })}
            onReadSubmission={readSubmission}
            onOpenScene={openScene}
          />
        ) : step === 'scenes' ? (
          <GmBoardScenes
            gameId={gameId}
            phase={phase}
            board={board}
            onGoToMap={() => goToStep('map')}
            selectedParts={selectedParts}
            onSelectPart={selectPart}
            onWrite={writeFor}
            onReadSubmission={readSubmission}
          />
        ) : (
          <GmBoardWrite gameId={gameId} phase={phase} board={board} selectedParts={selectedParts} onSelectPart={selectPart} onOpenScene={openScene} />
        )}
        </BoardToolbarSlotContext.Provider>

        <Drawer open={codex !== null} onClose={() => setCodex(null)} title="Codex" side="right">
          {codex !== null && (
            <div className="p-4">
              <GmCodexManager
                key={codex.name}
                gameId={gameId}
                phases={actionPhases}
                players={players}
                phaseId={phase.id}
                initialName={codex.name}
              />
            </div>
          )}
        </Drawer>

        {board && (
          <GmBoardNotesDrawer
            open={notesOpen}
            onClose={() => setNotesOpen(false)}
            phaseTitle={phase.title || `Phase ${phase.phase_number}`}
            notes={board.notes}
            onChange={(text) => store.update('notes', NOTES_KEY, () => ({ text }))}
            gameNotes={settings?.notes ?? ''}
            onGameChange={(text) => settingsStore.update('notes', NOTES_KEY, () => ({ text }))}
            readOnly={readOnly}
          />
        )}
      </div>
    </BoardRewardsContext.Provider>
    </BoardReadOnlyContext.Provider>
  );
}
