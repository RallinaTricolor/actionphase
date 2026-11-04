import { Badge, Select } from '@/components/ui';
import { canEditDelay } from '@/lib/resultParts';
import { DELAY_PRESETS, formatDelayLabel, isPresetDelay } from '@/lib/stagedDelays';
import type { ActionResult } from '@/types/phases';

interface StagedPartStatusProps {
  result: ActionResult;
  /** Without it the delay is shown as text (a read-only view). */
  onDelayChange?: (delayMinutes: number) => void;
  delayPending?: boolean;
}

/**
 * "Part N of M", when it was or will be revealed, and the delay picker for a
 * part that hasn't been revealed yet. Nothing for an unstaged result. The GM
 * always sees every part's real content, so this is only a schedule readout.
 */
export function StagedPartStatus({ result, onDelayChange, delayPending = false }: StagedPartStatusProps) {
  if (!(result.part_count !== undefined && result.part_count > 1)) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1" data-testid={`staged-status-${result.id}`}>
      <Badge variant="primary">
        Part {result.part_number} of {result.part_count}
      </Badge>
      {result.released_at ? (
        <span className="text-xs text-content-secondary">Revealed {new Date(result.released_at).toLocaleString()}</span>
      ) : result.unlocks_at ? (
        <span className="text-xs text-content-secondary">Reveals {new Date(result.unlocks_at).toLocaleString()}</span>
      ) : result.part_number === 1 ? (
        <span className="text-xs text-content-secondary">Revealed when published</span>
      ) : (
        <span className="text-xs text-content-secondary">Reveals after the previous part</span>
      )}
      {/* Retiming stays available on a published pending part, not just a
          draft: the usual reason to move a timer is that the scene is live and
          the players need longer. A custom delay that isn't a preset is shown
          as its own option so the selector never misstates the stored value. */}
      {canEditDelay(result) && !onDelayChange && result.reveal_delay_minutes !== undefined && (
        <span className="text-xs text-content-secondary">({formatDelayLabel(result.reveal_delay_minutes)} after the part before)</span>
      )}
      {canEditDelay(result) && onDelayChange && (
        <Select
          aria-label={`Delay before part ${result.part_number}`}
          selectSize="sm"
          value={String(result.reveal_delay_minutes ?? '')}
          onChange={(e) => onDelayChange(Number(e.target.value))}
          disabled={delayPending}
          data-testid={`edit-staged-delay-${result.id}`}
        >
          {/* An empty placeholder when the delay is unknown, so a missing field
              reads as "unknown" instead of quietly showing the first preset.
              The server always sends it; this makes a regression visible. */}
          {result.reveal_delay_minutes === undefined && <option value="">Delay unavailable</option>}
          {result.reveal_delay_minutes !== undefined && !isPresetDelay(result.reveal_delay_minutes) && (
            <option value={result.reveal_delay_minutes}>{formatDelayLabel(result.reveal_delay_minutes)}</option>
          )}
          {DELAY_PRESETS.map((minutes) => (
            <option key={minutes} value={minutes}>
              {formatDelayLabel(minutes)}
            </option>
          ))}
        </Select>
      )}
    </div>
  );
}
