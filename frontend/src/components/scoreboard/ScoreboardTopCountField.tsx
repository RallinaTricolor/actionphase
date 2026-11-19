import { Input } from '@/components/ui';
import { MAX_SCOREBOARD_TOP_COUNT, scoreboardTopCountError } from '@/lib/scoreboardEditing';

interface ScoreboardTopCountFieldProps {
  /** Absent means players see every row. */
  value: number | undefined;
  /** Whether the board is in name order, where "the top" means the first names. */
  sortedByName: boolean;
  onChange: (value: number | undefined) => void;
}

/**
 * "Players see only the top N": puts a target on the leaders without showing
 * where everyone else stands. The server makes the cut, so the rows below it
 * never reach a player's browser.
 */
export function ScoreboardTopCountField({ value, sortedByName, onChange }: ScoreboardTopCountFieldProps) {
  const error = scoreboardTopCountError(value);
  return (
    <div className="space-y-2" data-testid="scoreboard-top-count-field">
      <div className="max-w-xs">
        <Input
          label="Players see only the top"
          optional
          type="number"
          inputMode="numeric"
          min={1}
          max={MAX_SCOREBOARD_TOP_COUNT}
          step={1}
          inputSize="sm"
          placeholder="Everyone"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
          error={error}
        />
      </div>
      <p className="text-sm text-content-secondary">
        Leave blank to show every character. The GM and audience always see everyone, and so does everyone once the
        game reaches its epilogue.
      </p>
      {value !== undefined && !error && sortedByName && (
        <p className="text-sm text-content-secondary" data-testid="scoreboard-top-count-name-note">
          The board is in name order, so players see the first {value} by name. Sort by a column to show the leaders.
        </p>
      )}
    </div>
  );
}
