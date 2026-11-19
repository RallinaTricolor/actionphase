import { useState } from 'react';
import { Alert, Badge, Button, Card, Input, Select, Toggle } from '@/components/ui';
import { ConfirmRemoval } from '@/components/characters/sheet-editor/ConfirmRemoval';
import { ReorderButtons } from '@/components/characters/sheet-editor/ReorderButtons';
import {
  findScoreboardSourceField,
  MAX_SCOREBOARD_LABEL_LENGTH,
  withScoreboardSource,
  type ScoreboardSourceTab,
} from '@/lib/scoreboardEditing';
import type { ScoreboardColumn, ScoreboardDisplay } from '@/types/scoreboard';
import { ScoreboardBandsEditor } from './ScoreboardBandsEditor';
import { ScoreboardColumnPicker } from './ScoreboardColumnPicker';

interface ScoreboardColumnEditorProps {
  column: ScoreboardColumn;
  tabs: readonly ScoreboardSourceTab[];
  entryNames: ReadonlyMap<string, readonly string[]>;
  canMoveUp: boolean;
  canMoveDown: boolean;
  /** Another column reads the same value. */
  isDuplicate: boolean;
  /** The board sorts by this column. */
  isSortKey: boolean;
  onChange: (column: ScoreboardColumn) => void;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
}

/** One column of the board: where it reads from and how its cells read. */
export function ScoreboardColumnEditor({
  column,
  tabs,
  entryNames,
  canMoveUp,
  canMoveDown,
  isDuplicate,
  isSortKey,
  onChange,
  onMove,
  onRemove,
}: ScoreboardColumnEditorProps) {
  const field = findScoreboardSourceField(tabs, column);
  const isBroken = !field;
  const [changingSource, setChangingSource] = useState(false);
  const [confirmingRemoval, setConfirmingRemoval] = useState(false);

  const name = column.label.trim() || column.entry;
  const tab = tabs.find((candidate) => candidate.key === column.tab_key);
  const display: ScoreboardDisplay = column.display ?? 'value';
  // A broken column may already show value / max; it stays listed until fixed.
  const offersMax = field?.type === 'track' || display === 'value_max';

  const source = [
    tab?.label,
    column.entry,
    tab && tab.fields.length > 1 ? field?.label : undefined,
  ].filter(Boolean).join(' · ');

  const setDisplay = (next: ScoreboardDisplay) => {
    const { display: _previous, ...rest } = column;
    if (next === 'value') return onChange(rest);
    onChange({
      ...rest,
      display: next,
      ...(next === 'bands' && !column.bands?.length && { bands: [{ label: '' }] }),
    });
  };

  return (
    <Card variant="bordered" padding="none" data-testid="scoreboard-column-editor">
      <div className="flex items-start justify-between gap-2 rounded-t-md border-b border-theme-default surface-sunken px-3 py-2.5 sm:px-4">
        <div className="min-w-0">
          <h4 className="flex items-center gap-2 font-medium text-content-primary">
            <span className="truncate">{name}</span>
            {column.hidden && <Badge variant="neutral">Hidden</Badge>}
          </h4>
          <p className="truncate text-sm text-content-secondary">{source}</p>
        </div>
        <div className="flex shrink-0 items-center">
          <ReorderButtons name={name} canMoveUp={canMoveUp} canMoveDown={canMoveDown} onMove={onMove} />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label={`Remove ${name}`}
            onClick={() => setConfirmingRemoval(true)}
          >
            Remove
          </Button>
        </div>
      </div>

      <div className="space-y-3 p-3 sm:p-4">
        {confirmingRemoval && (
          <ConfirmRemoval
            message={`Remove the ${name} column?${isSortKey ? ' The board will stop sorting by it.' : ''}`}
            onRemove={onRemove}
            onKeep={() => setConfirmingRemoval(false)}
          />
        )}

        {isBroken && (
          <Alert variant="warning" title="This column has lost its source" data-testid="scoreboard-column-broken">
            The character sheet no longer has this tab or field. Choose a new source or remove the column to save.
          </Alert>
        )}

        {isDuplicate && !isBroken && (
          <p className="text-sm text-content-secondary">Another column reads the same value.</p>
        )}

        {isBroken || changingSource ? (
          <ScoreboardColumnPicker
            tabs={tabs}
            entryNames={entryNames}
            initial={column}
            submitLabel="Use this source"
            onPick={(next, fieldType) => {
              onChange(withScoreboardSource(column, next, fieldType));
              setChangingSource(false);
            }}
            onCancel={isBroken ? undefined : () => setChangingSource(false)}
          />
        ) : (
          <Button type="button" variant="ghost" size="sm" onClick={() => setChangingSource(true)}>
            Change source
          </Button>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label="Heading"
            inputSize="sm"
            maxLength={MAX_SCOREBOARD_LABEL_LENGTH}
            value={column.label}
            onChange={(e) => onChange({ ...column, label: e.target.value })}
          />
          <Select
            label="Cells show"
            selectSize="sm"
            value={display}
            onChange={(e) => setDisplay(e.target.value as ScoreboardDisplay)}
          >
            <option value="value">Value</option>
            {offersMax && <option value="value_max">Value of max</option>}
            <option value="bands">Ranges</option>
          </Select>
        </div>

        <Toggle
          size="sm"
          checked={!!column.hidden}
          onChange={(hidden) => {
            const { hidden: _previous, ...rest } = column;
            onChange(hidden ? { ...rest, hidden: true } : rest);
          }}
          label="Hide from players"
          description="The GM and audience still see it, and it can still decide the order."
        />

        {display === 'bands' && (
          <ScoreboardBandsEditor column={column} isTrack={field?.type === 'track'} onChange={onChange} />
        )}
      </div>
    </Card>
  );
}
