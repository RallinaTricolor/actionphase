import { useState } from 'react';
import { Alert, Button, Input, Select } from '@/components/ui';
import { ConfirmRemoval } from '@/components/characters/sheet-editor/ConfirmRemoval';
import { ReorderButtons } from '@/components/characters/sheet-editor/ReorderButtons';
import {
  checkScoreboardBands,
  formatScoreboardBandRange,
  scoreboardBandLabel,
} from '@/lib/scoreboardBands';
import {
  MAX_SCOREBOARD_BAND_LABEL_SOURCE_LENGTH,
  MAX_SCOREBOARD_BANDS,
  MAX_SCOREBOARD_LABEL_LENGTH,
  scoreboardBandLabelError,
  scoreboardBandsProblem,
  scoreboardLabelText,
} from '@/lib/scoreboardEditing';
import type { ScoreboardBand, ScoreboardBandBasis, ScoreboardColumn } from '@/types/scoreboard';
import { ScoreboardLabel } from './ScoreboardLabel';

interface ScoreboardBandsEditorProps {
  column: ScoreboardColumn;
  /** Tracks have a maximum, so their ranges can be percentages of it. */
  isTrack: boolean;
  onChange: (column: ScoreboardColumn) => void;
}

const parseBound = (text: string) => {
  const parsed = Number(text);
  return text.trim() === '' || !Number.isFinite(parsed) ? undefined : parsed;
};

interface BoundOperatorProps {
  label: string;
  strict: boolean | undefined;
  disabled: boolean;
  onChange: (strict: boolean) => void;
}

function BoundOperator({ label, strict, disabled, onChange }: BoundOperatorProps) {
  return (
    <div className="w-14 shrink-0">
      <Select
        aria-label={label}
        selectSize="sm"
        value={strict ? 'strict' : 'inclusive'}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value === 'strict')}
      >
        <option value="strict">&lt;</option>
        <option value="inclusive">≤</option>
      </Select>
    </div>
  );
}

/**
 * The labelled ranges of one column, one row per range, written the way a GM
 * would say it: `5 < HP < 10 → Bloodied`. Rows are checked from the top, so
 * their order decides what an overlap shows.
 */
export function ScoreboardBandsEditor({ column, isTrack, onChange }: ScoreboardBandsEditorProps) {
  const [removingIndex, setRemovingIndex] = useState<number | null>(null);
  const [testText, setTestText] = useState('');

  const bands = column.bands ?? [];
  const isPercent = column.band_basis === 'percent';
  const name = column.label.trim() || column.entry;
  const subject = isPercent ? `${name} %` : name;
  const fallback = column.fallback_label?.trim();

  const setBands = (next: ScoreboardBand[]) => onChange({ ...column, bands: next });
  const updateBand = (index: number, patch: Partial<ScoreboardBand>) =>
    setBands(bands.map((band, i) => (i === index ? { ...band, ...patch } : band)));

  const moveBand = (index: number, direction: -1 | 1) => {
    const next = [...bands];
    [next[index], next[index + direction]] = [next[index + direction], next[index]];
    setRemovingIndex(null);
    setBands(next);
  };

  const removeBand = (index: number) => {
    setRemovingIndex(null);
    setBands(bands.filter((_, i) => i !== index));
  };

  const problem = scoreboardBandsProblem(column);
  const { overlaps, gaps } = checkScoreboardBands(bands);
  // With a fallback, a gap is the fallback's job.
  const shownGaps = fallback ? [] : gaps;

  const testValue = parseBound(testText);
  const testLabel = testValue === undefined ? '' : scoreboardBandLabel(column, testValue);

  return (
    <div className="space-y-3 border-t border-theme-default pt-3" data-testid="scoreboard-bands-editor">
      {isTrack && (
        <Select
          label="Ranges measure"
          selectSize="sm"
          value={isPercent ? 'percent' : 'value'}
          onChange={(e) => {
            const { band_basis: _dropped, ...rest } = column;
            const basis = e.target.value as ScoreboardBandBasis;
            onChange(basis === 'percent' ? { ...rest, band_basis: 'percent' } : rest);
          }}
          helperText={isPercent ? "Each character's value as a percentage of their own maximum." : undefined}
        >
          <option value="value">The value</option>
          <option value="percent">Percent of maximum</option>
        </Select>
      )}

      <p className="text-sm text-content-secondary">
        Labels can use <strong>**bold**</strong>, <em>*italic*</em> and colours such as
        {' '}<code>[color:red]Bloodied[/color]</code>. Up to {MAX_SCOREBOARD_LABEL_LENGTH} characters, not counting formatting.
      </p>

      <ol className="space-y-2">
        {bands.map((band, index) => {
          const position = index + 1;
          return (
            <li key={index} className="space-y-2" data-testid="scoreboard-band-row">
              <div className="flex flex-wrap items-center gap-1.5">
                <div className="w-20 shrink-0">
                  <Input
                    aria-label={`Range ${position} lower bound`}
                    type="number"
                    step="any"
                    inputSize="sm"
                    value={band.min ?? ''}
                    onChange={(e) => updateBand(index, { min: parseBound(e.target.value) })}
                  />
                </div>
                <BoundOperator
                  label={`Range ${position} lower comparison`}
                  strict={band.min_strict}
                  disabled={band.min === undefined}
                  onChange={(min_strict) => updateBand(index, { min_strict })}
                />
                <span className="max-w-24 truncate text-sm text-content-secondary">{subject}</span>
                <BoundOperator
                  label={`Range ${position} upper comparison`}
                  strict={band.max_strict}
                  disabled={band.max === undefined}
                  onChange={(max_strict) => updateBand(index, { max_strict })}
                />
                <div className="w-20 shrink-0">
                  <Input
                    aria-label={`Range ${position} upper bound`}
                    type="number"
                    step="any"
                    inputSize="sm"
                    value={band.max ?? ''}
                    onChange={(e) => updateBand(index, { max: parseBound(e.target.value) })}
                  />
                </div>
                <span aria-hidden="true" className="text-content-tertiary">→</span>
                <div className="min-w-32 flex-1">
                  <Input
                    aria-label={`Range ${position} label`}
                    inputSize="sm"
                    placeholder="Label"
                    maxLength={MAX_SCOREBOARD_BAND_LABEL_SOURCE_LENGTH}
                    error={scoreboardBandLabelError(band.label)}
                    value={band.label}
                    onChange={(e) => updateBand(index, { label: e.target.value })}
                  />
                </div>
                <ReorderButtons
                  name={`range ${position}`}
                  canMoveUp={index > 0}
                  canMoveDown={index < bands.length - 1}
                  onMove={(direction) => moveBand(index, direction)}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label={`Remove range ${position}`}
                  onClick={() => setRemovingIndex(index)}
                >
                  Remove
                </Button>
              </div>
              {removingIndex === index && (
                <ConfirmRemoval
                  message={`Remove the range${scoreboardLabelText(band.label).trim() ? ` “${scoreboardLabelText(band.label).trim()}”` : ''}?`}
                  onRemove={() => removeBand(index)}
                  onKeep={() => setRemovingIndex(null)}
                />
              )}
            </li>
          );
        })}
      </ol>

      {problem && (
        <p className="text-sm text-semantic-danger" data-testid="scoreboard-bands-problem">{problem}.</p>
      )}

      {bands.length < MAX_SCOREBOARD_BANDS ? (
        <Button type="button" variant="secondary" size="sm" onClick={() => setBands([...bands, { label: '' }])}>
          Add range
        </Button>
      ) : (
        <p className="text-sm text-content-secondary">A column can have {MAX_SCOREBOARD_BANDS} ranges.</p>
      )}

      {(overlaps.length > 0 || shownGaps.length > 0) && (
        <Alert variant="warning" data-testid="scoreboard-band-warnings">
          <ul className="space-y-1">
            {overlaps.map(({ winner, loser }) => (
              <li key={`${winner}\u0000${loser}`}>
                “<ScoreboardLabel text={winner} />” and “<ScoreboardLabel text={loser} />” overlap.
                {' '}“<ScoreboardLabel text={winner} />” is higher in the list, so it wins.
              </li>
            ))}
            {shownGaps.length > 0 && (
              <li>
                No range covers {shownGaps.map((gap) => formatScoreboardBandRange(gap, subject)).join(', ')}.
                Those cells stay blank unless you add a label for no match.
              </li>
            )}
          </ul>
        </Alert>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          label="Label when no range matches"
          optional
          inputSize="sm"
          maxLength={MAX_SCOREBOARD_BAND_LABEL_SOURCE_LENGTH}
          error={scoreboardBandLabelError(column.fallback_label)}
          value={column.fallback_label ?? ''}
          onChange={(e) => onChange({ ...column, fallback_label: e.target.value })}
        />
        <div>
          <Input
            label={isPercent ? 'Test a percentage' : 'Test a value'}
            type="number"
            step="any"
            inputSize="sm"
            value={testText}
            onChange={(e) => setTestText(e.target.value)}
          />
          {testValue !== undefined && (
            <p className="mt-1 text-sm text-content-secondary" data-testid="scoreboard-band-test-result" aria-live="polite">
              {testLabel ? <>Shows <ScoreboardLabel text={testLabel} className="font-medium text-content-primary" /></> : 'Shows a blank cell'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
