import { useState, type FormEvent } from 'react';
import { Button, Checkbox, Input, Select } from '@/components/ui';
import { CODEX_TYPES, newCodexEntry } from '@/lib/gmBoard/codex';
import { newItemKey } from '@/lib/gmBoard/store';
import { splitList } from '@/lib/gmBoard/text';
import type { CodexEntry, CodexType } from '@/lib/gmBoard/types';
import type { CodexPhase } from './CodexEntryEditor';

interface CodexAddFormProps {
  phases: CodexPhase[];
  /** Opened from a phase's board: the new entry can be scoped to it (and is, unless unticked). */
  phaseId?: number;
  /** A name to start with (text the GM selected in a submission). */
  initialName?: string;
  /** Called with the new entry; the caller saves it. */
  onAdd: (entry: CodexEntry) => void;
}

/**
 * The codex's add form: type, name, other names, and (on a board) whether
 * it's for this phase only. Clears itself after adding. Used by the codex
 * tab and Game setup (GmCodexManager) and by Read's "+ Codex" dialog.
 */
export function CodexAddForm({ phases, phaseId, initialName = '', onAdd }: CodexAddFormProps) {
  const [type, setType] = useState<CodexType>('Location');
  const [name, setName] = useState(initialName);
  const [aliases, setAliases] = useState('');
  const [thisPhaseOnly, setThisPhaseOnly] = useState(phaseId !== undefined);
  const phaseTitle = (id: number) => phases.find((p) => p.id === id)?.title ?? `Phase ${id}`;

  const add = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    onAdd(
      newCodexEntry({
        id: newItemKey('cx'),
        type,
        name: name.trim(),
        aliases: splitList(aliases),
        phases: thisPhaseOnly && phaseId !== undefined ? [phaseId] : [],
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        {phaseId !== undefined ? (
          <Checkbox
            id="codex-new-this-phase"
            label={`${phaseTitle(phaseId)} only`}
            checked={thisPhaseOnly}
            onChange={(e) => setThisPhaseOnly(e.target.checked)}
          />
        ) : (
          <span className="text-sm text-content-secondary">Applies to every phase. Narrow it after adding.</span>
        )}
        <Button type="submit" variant="primary" size="sm" disabled={!name.trim()}>
          Add to codex
        </Button>
      </div>
    </form>
  );
}
