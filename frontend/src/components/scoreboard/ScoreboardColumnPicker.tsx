import { useState } from 'react';
import { Button, Combobox, Select } from '@/components/ui';
import {
  MAX_SCOREBOARD_ENTRY_LENGTH,
  type ScoreboardFieldType,
  type ScoreboardSource,
  type ScoreboardSourceTab,
} from '@/lib/scoreboardEditing';

interface ScoreboardColumnPickerProps {
  tabs: readonly ScoreboardSourceTab[];
  /** Entry names characters already use, by tab key. */
  entryNames: ReadonlyMap<string, readonly string[]>;
  /** The column's current source, when changing one. */
  initial?: ScoreboardSource;
  submitLabel: string;
  onPick: (source: ScoreboardSource, fieldType: ScoreboardFieldType) => void;
  onCancel?: () => void;
}

/** Numbers is what most boards read, so it comes first when there is no other reason. */
function startingTab(tabs: readonly ScoreboardSourceTab[], initial?: ScoreboardSource) {
  return tabs.find((tab) => tab.key === initial?.tab_key)
    ?? tabs.find((tab) => tab.key === 'numbers')
    ?? tabs[0];
}

/**
 * Chooses where a column reads from: a tab, an entry on it, and the field when
 * the tab has more than one number. The entry can be typed, since a GM may set
 * the board up before any character has that entry.
 */
export function ScoreboardColumnPicker({
  tabs,
  entryNames,
  initial,
  submitLabel,
  onPick,
  onCancel,
}: ScoreboardColumnPickerProps) {
  const [tabKey, setTabKey] = useState(() => startingTab(tabs, initial)?.key);
  const tab = tabs.find((candidate) => candidate.key === tabKey);
  const isInitialTab = tab !== undefined && tab.key === initial?.tab_key;
  const [entry, setEntry] = useState(isInitialTab ? initial.entry : '');
  const [fieldKey, setFieldKey] = useState(isInitialTab ? initial.field_key : tab?.fields[0]?.key);

  if (!tab) {
    return (
      <p className="text-sm text-content-secondary">
        No character sheet tab has a number field, so there is nothing to show yet.
      </p>
    );
  }

  const chooseTab = (key: string) => {
    setTabKey(key);
    setEntry('');
    setFieldKey(tabs.find((candidate) => candidate.key === key)?.fields[0]?.key);
  };

  const field = tab.fields.find((candidate) => candidate.key === fieldKey) ?? tab.fields[0];
  const names = entryNames.get(tab.key) ?? [];
  const options = (entry && !names.includes(entry) ? [...names, entry] : names)
    .map((name) => ({ value: name, label: name }));
  const trimmed = entry.trim();
  const tooLong = Array.from(trimmed).length > MAX_SCOREBOARD_ENTRY_LENGTH;

  return (
    <div className="space-y-3" data-testid="scoreboard-column-picker">
      <div className="grid gap-3 sm:grid-cols-2">
        <Select label="Sheet tab" selectSize="sm" value={tab.key} onChange={(e) => chooseTab(e.target.value)}>
          {tabs.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
        </Select>
        <Combobox
          key={tab.key}
          label="Entry"
          size="sm"
          options={options}
          value={entry || null}
          onChange={setEntry}
          onCreate={setEntry}
          createLabel={(text) => `Use “${text}”`}
          placeholder="Pick or type a name"
          error={tooLong ? `Keep it to ${MAX_SCOREBOARD_ENTRY_LENGTH} characters` : undefined}
          helperText="Each character's entry with this name is used. Capitals don't matter."
        />
        {tab.fields.length > 1 && (
          <Select label="Field" selectSize="sm" value={field.key} onChange={(e) => setFieldKey(e.target.value)}>
            {tab.fields.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
          </Select>
        )}
      </div>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={!trimmed || tooLong}
          onClick={() => onPick({ tab_key: tab.key, entry: trimmed, field_key: field.key }, field.type)}
        >
          {submitLabel}
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
        )}
      </div>
    </div>
  );
}
