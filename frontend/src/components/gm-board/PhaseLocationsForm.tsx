import { useState, type FormEvent } from 'react';
import { Button, Checkbox, Input, Select } from '@/components/ui';
import { otherPhaseLocations } from '@/lib/gmBoard/codex';
import type { CodexEntry } from '@/lib/gmBoard/types';
import type { CodexPhase } from './CodexEntryEditor';

interface PhaseLocationsFormProps {
  codex: CodexEntry[];
  /** The game's action phases, in order. */
  phases: CodexPhase[];
  phaseId: number;
  /** Makes a new location for this phase. */
  onCreate: (name: string) => void;
  /** Adds this phase to other phases' locations. */
  onReuse: (entries: CodexEntry[]) => void;
}

/**
 * Adds locations to one phase's Map: a new one by name, or some of another
 * phase's. Reusing keeps the same codex entry (its other names and notes),
 * with this phase added to it. Defaults to the latest earlier phase with
 * places, all ticked, since the usual case is "same places as last time,
 * give or take".
 */
export function PhaseLocationsForm({ codex, phases, phaseId, onCreate, onReuse }: PhaseLocationsFormProps) {
  const [name, setName] = useState('');
  const groups = otherPhaseLocations(codex, phases, phaseId);
  const here = phases.findIndex((p) => p.id === phaseId);
  const earlier = groups.filter((g) => phases.findIndex((p) => p.id === g.phase.id) < here);
  const [fromId, setFromId] = useState<number | null>(null);
  const from = groups.find((g) => g.phase.id === fromId) ?? earlier[earlier.length - 1] ?? groups[0];
  const [unticked, setUnticked] = useState<Set<string>>(new Set());
  const picked = from ? from.entries.filter((e) => !unticked.has(e.id)) : [];

  const create = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    onCreate(name.trim());
    setName('');
  };

  return (
    <div className="space-y-4" data-testid="phase-locations-form">
      <form onSubmit={create} className="flex items-end gap-2" aria-label="Add a location">
        <div className="flex-1">
          <Input id="phase-location-name" label="New location" placeholder="e.g. Lantern Bridge" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <Button type="submit" variant="primary" disabled={!name.trim()}>
          Add
        </Button>
      </form>

      {from && (
        <fieldset className="space-y-2" data-testid="phase-locations-reuse">
          <legend className="text-sm font-medium text-content-primary">Or use places from another phase</legend>
          {groups.length > 1 && (
            <div className="w-64">
              <Select
                id="phase-locations-from"
                aria-label="From"
                selectSize="sm"
                value={String(from.phase.id)}
                onChange={(e) => {
                  setFromId(Number(e.target.value));
                  setUnticked(new Set());
                }}
              >
                {groups.map((g) => (
                  <option key={g.phase.id} value={g.phase.id}>
                    {g.phase.title} ({g.entries.length})
                  </option>
                ))}
              </Select>
            </div>
          )}
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {from.entries.map((e) => (
              <Checkbox
                key={e.id}
                id={`phase-location-reuse-${e.id}`}
                label={e.name}
                checked={!unticked.has(e.id)}
                onChange={(ev) =>
                  setUnticked((s) => {
                    const next = new Set(s);
                    if (ev.target.checked) next.delete(e.id);
                    else next.add(e.id);
                    return next;
                  })
                }
              />
            ))}
          </div>
          <Button type="button" variant="secondary" size="sm" disabled={!picked.length} onClick={() => onReuse(picked)}>
            Add {picked.length} from {from.phase.title}
          </Button>
        </fieldset>
      )}
    </div>
  );
}
