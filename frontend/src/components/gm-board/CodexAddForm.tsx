import { useState, type FormEvent } from 'react';
import { Button, Input, Select } from '@/components/ui';
import { CODEX_TYPES, defaultPhases, newCodexEntry } from '@/lib/gmBoard/codex';
import { newItemKey } from '@/lib/gmBoard/store';
import { splitList } from '@/lib/gmBoard/text';
import type { CodexEntry, CodexType } from '@/lib/gmBoard/types';
import type { CodexPhase } from './CodexEntryEditor';

interface CodexAddFormProps {
  phases: CodexPhase[];
  /**
   * The phase a location or objective starts as: the board's, or on Game
   * setup the current one. None (no action phases yet): every phase.
   */
  phaseId?: number;
  /** A name to start with (text the GM selected in a submission). */
  initialName?: string;
  /** Called with the new entry; the caller saves it. */
  onAdd: (entry: CodexEntry) => void;
}

/**
 * The codex's add form: type, name, other names, and which phase it applies
 * to. Locations and objectives start as one phase's, the rest as every
 * phase's (`defaultPhases`), until the GM picks. Clears itself after adding.
 * Used by the codex tab and Game setup (GmCodexManager) and by Read's
 * "+ Codex" dialog.
 */
export function CodexAddForm({ phases, phaseId, initialName = '', onAdd }: CodexAddFormProps) {
  const [type, setType] = useState<CodexType>('Location');
  const [name, setName] = useState(initialName);
  const [aliases, setAliases] = useState('');
  // '' is every phase. Follows the type until the GM picks one.
  const [picked, setPicked] = useState<string | null>(null);
  const scope = picked ?? String(defaultPhases(type, phaseId)[0] ?? '');
  const scopeOptions = phaseId !== undefined && !phases.some((p) => p.id === phaseId) ? [...phases, { id: phaseId, title: `Phase ${phaseId}` }] : phases;

  const add = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    onAdd(
      newCodexEntry({
        id: newItemKey('cx'),
        type,
        name: name.trim(),
        aliases: splitList(aliases),
        phases: scope ? [Number(scope)] : [],
      }),
    );
    setName('');
    setAliases('');
  };

  return (
    <form onSubmit={add} className="space-y-3 rounded-lg border border-theme-default surface-raised p-4" aria-label="Add to the codex">
      <div className="grid grid-cols-1 sm:grid-cols-[10rem_1fr] gap-3">
        <Select id="codex-new-type" label="Type" value={type} onChange={(e) => setType(e.target.value as CodexType)}>
          {CODEX_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </Select>
        <Input id="codex-new-name" label="Name" placeholder="e.g. The Sunken Market" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <Input
        id="codex-new-aliases"
        label="Other names"
        optional
        placeholder="market, the stalls"
        helperText="Comma separated."
        value={aliases}
        onChange={(e) => setAliases(e.target.value)}
      />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="w-64">
          <Select id="codex-new-phase" label="Applies to" value={scope} onChange={(e) => setPicked(e.target.value)}>
            <option value="">Every phase</option>
            {scopeOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </Select>
        </div>
        <Button type="submit" variant="primary" size="sm" disabled={!name.trim()}>
          Add to codex
        </Button>
      </div>
    </form>
  );
}
