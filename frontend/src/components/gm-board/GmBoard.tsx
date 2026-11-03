import { useCallback, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Drawer, Spinner } from '@/components/ui';
import { TabNavigation } from '@/components/layout/TabNavigation';
import { useGameContext } from '@/contexts/GameContext';
import { useGmBoard, useGmBoardStore } from '@/hooks/useGmBoard';
import { apiClient } from '@/lib/api';
import { boardCast } from '@/lib/gmBoard/cast';
import { NOTES_KEY } from '@/lib/gmBoard/store';
import { BOARD_STEPS, boardPath, boardSetupPath, parseBoardStep, resultsAreaPath } from '@/lib/gmBoard/steps';
import type { GamePhase } from '@/types/phases';
import { GmBoardConflicts } from './GmBoardConflicts';
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
}

/**
 * The GM results board for one action phase: the Read → Map → Scenes → Write
 * steps, with the step in the URL (`?step=`). Which result part the GM last
 * picked for each character lives here, so Scenes' "Add to draft" and Write
 * agree on it.
 */
export function GmBoard({ gameId, gameTitle, phase }: GmBoardProps) {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const step = parseBoardStep(params.get('step'));
  const [notesOpen, setNotesOpen] = useState(false);
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
  const store = useGmBoardStore(gameId, phase.id);

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

  return (
    <div className="px-6 py-6 space-y-4" data-testid="gm-board">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link to={resultsAreaPath(gameId)} className="text-sm text-content-tertiary hover:underline">
            &larr; {gameTitle}: results
          </Link>
          <h1 className="text-2xl font-bold text-content-primary mt-1">Results board</h1>
          <p className="text-sm text-content-secondary">{phase.title || `Phase ${phase.phase_number}`}</p>
        </div>
        <div className="flex items-center gap-2">
          <GmBoardSaveStatus status={store.status} error={store.saveError} onRetry={() => void store.flush()} />
          <Button type="button" variant="secondary" onClick={() => setCodex({ name: '' })}>
            Codex
          </Button>
          <Button type="button" variant="secondary" onClick={() => setNotesOpen(true)} disabled={!board}>
            Notes
          </Button>
          <Button type="button" variant="ghost" onClick={() => navigate(boardSetupPath(gameId))}>
            Game setup
          </Button>
        </div>
      </div>

      <GmBoardConflicts lost={store.lost} onKeepMine={store.keepMine} onDismiss={store.dismissLost} />

      <TabNavigation
        tabs={BOARD_STEPS.map((s) => ({ id: s.id, label: s.label }))}
        activeTab={step}
        onTabChange={goToStep}
        getTabHref={(id) => boardPath(gameId, phase.id, parseBoardStep(id))}
      />

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
        />
      ) : (
        <GmBoardWrite gameId={gameId} phase={phase} board={board} selectedParts={selectedParts} onSelectPart={selectPart} onOpenScene={openScene} />
      )}

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
          notes={board.notes}
          onChange={(text) => store.update('notes', NOTES_KEY, () => ({ text }))}
        />
      )}
    </div>
  );
}
