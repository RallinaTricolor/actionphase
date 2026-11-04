import { Alert, Button } from '@/components/ui';
import { useGmSettings } from '@/hooks/useGmBoard';
import { phaseLocations } from '@/lib/gmBoard/codex';
import type { BoardDoc } from '@/lib/gmBoard/types';

interface GmBoardFirstRunProps {
  gameId: number;
  phaseId: number;
  board: BoardDoc;
  onOpenCodex: () => void;
  onOpenSetup: () => void;
}

/**
 * A short guide on a board with nothing on it yet: the four steps, and the
 * one thing a first card needs (a location for its row on the Map). It goes
 * away once the board has a card or a scene, so nothing needs remembering.
 * Not shown to viewers.
 */
export function GmBoardFirstRun({ gameId, phaseId, board, onOpenCodex, onOpenSetup }: GmBoardFirstRunProps) {
  const { settings } = useGmSettings(gameId);
  if (board.cards.length || board.scenes.length || !settings) return null;
  const noPlaces = phaseLocations(settings.codex, phaseId).length === 0;

  return (
    <details open className="rounded-lg border border-theme-default surface-raised p-4 text-sm" data-testid="gm-board-first-run">
      <summary className="cursor-pointer font-semibold text-content-primary">How the results board works</summary>
      <ol className="mt-2 list-decimal space-y-1 pl-5 text-content-secondary">
        <li>
          <strong className="text-content-primary">Read</strong> each submission and card what matters: select a sentence and choose + Card,
          or + IF card for a plan that waits on something.
        </li>
        <li>
          <strong className="text-content-primary">Map</strong> lays the cards out by place and time slot. Resolve one slot at a time, give each
          card an outcome, and make a scene where people meet.
        </li>
        <li>
          <strong className="text-content-primary">Scenes</strong>: write what happens as moments, and tick who reads each one. Each reader gets
          it in their own words.
        </li>
        <li>
          <strong className="text-content-primary">Write</strong> each result from that player’s brief, check it, and publish.
        </li>
      </ol>
      <p className="mt-2 text-content-tertiary">
        Result drafts are shared with the results area, so you can switch back at any time. Everything here saves as you go.
      </p>
      {noPlaces && (
        <Alert variant="warning" className="mt-3" title="This phase has no locations yet">
          <p>Locations are the Map’s rows, so every card needs one. Add this phase’s places to the codex first.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="primary" onClick={onOpenCodex}>
              Add locations in the codex
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={onOpenSetup}>
              Open game setup
            </Button>
          </div>
        </Alert>
      )}
    </details>
  );
}
