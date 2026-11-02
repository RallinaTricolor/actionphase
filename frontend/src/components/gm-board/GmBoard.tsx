import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Alert, Button, Card, CardBody, Spinner } from '@/components/ui';
import { TabNavigation } from '@/components/layout/TabNavigation';
import { useGmBoard, useGmBoardStore } from '@/hooks/useGmBoard';
import { NOTES_KEY } from '@/lib/gmBoard/store';
import { BOARD_STEPS, boardPath, boardSetupPath, parseBoardStep, resultsAreaPath, type BoardStep } from '@/lib/gmBoard/steps';
import type { GamePhase } from '@/types/phases';
import { GmBoardConflicts } from './GmBoardConflicts';
import { GmBoardNotesDrawer } from './GmBoardNotesDrawer';
import { GmBoardSaveStatus } from './GmBoardSaveStatus';

interface GmBoardProps {
  gameId: number;
  gameTitle: string;
  phase: GamePhase;
}

const STEP_INTROS: Record<BoardStep, string> = {
  read: 'Read each submission and turn the parts that matter into plan cards.',
  map: 'Place cards on a grid of locations and time slots, mark where people meet, and set outcomes.',
  scenes: 'Write each scene as moments, each with the people who read it.',
  write: 'Draft each player’s result from their brief, with checks before you publish.',
};

/**
 * The GM results board for one action phase: the Read → Map → Scenes → Write
 * steps, with the step in the URL (`?step=`). The steps are empty for now.
 */
export function GmBoard({ gameId, gameTitle, phase }: GmBoardProps) {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const step = parseBoardStep(params.get('step'));
  const [notesOpen, setNotesOpen] = useState(false);

  const { board, isLoading, error } = useGmBoard(gameId, phase.id);
  const store = useGmBoardStore(gameId, phase.id);

  const goToStep = (next: string) => {
    const nextParams = new URLSearchParams(params);
    if (next === 'read') nextParams.delete('step');
    else nextParams.set('step', next);
    setParams(nextParams);
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
      ) : (
        <Card variant="bordered" padding="md" data-testid={`gm-board-step-${step}`}>
          <CardBody>
            <p className="text-content-primary">{STEP_INTROS[step]}</p>
            {step === 'scenes' && board.scenes.length === 0 ? (
              <p className="text-sm text-content-secondary mt-2">
                No scenes yet. Scenes are made from busy cells on the{' '}
                <Link to={boardPath(gameId, phase.id, 'map')} className="underline">
                  Map
                </Link>
                .
              </p>
            ) : (
              <p className="text-sm text-content-tertiary mt-2">This step isn’t built yet.</p>
            )}
          </CardBody>
        </Card>
      )}

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
