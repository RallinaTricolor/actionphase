import { useState, type FormEvent } from 'react';
import { Badge, Button, Checkbox, Input, Select, Spinner } from '@/components/ui';
import { useToast } from '@/contexts/ToastContext';
import { useGmSettings, useGmSettingsStore } from '@/hooks/useGmBoard';
import { useBoardReadOnly } from '@/hooks/useBoardReadOnly';
import { CODEX_TYPES, codexDoc, codexTone, inPhase, newCodexEntry } from '@/lib/gmBoard/codex';
import { newItemKey } from '@/lib/gmBoard/store';
import { splitList } from '@/lib/gmBoard/text';
import type { CodexEntry, CodexType } from '@/lib/gmBoard/types';
import { CodexEntryEditor, type CodexCharacter, type CodexPhase } from './CodexEntryEditor';

interface GmCodexManagerProps {
  gameId: number;
  phases: CodexPhase[];
  players: CodexCharacter[];
  /**
   * Opened from a phase's board: new entries can be scoped to it, and the
   * list shows that phase's entries (with a switch for the rest).
   */
  phaseId?: number;
  /** A name to start the add form with (text the GM selected in a submission). */
  initialName?: string;
  /** Called with a new entry's id, after it's added. */
  onCreated?: (entry: CodexEntry) => void;
  readOnly?: boolean;
}

/**
 * The game's codex: an add form, then every entry with its type, scope and
 * other names. Edit opens the entry in place. Only GMs see the codex (and
 * viewers, when the board is shared). Used on the setup page and in the
 * board's codex drawer; both edit the same settings.
 */
export function GmCodexManager({
  gameId,
  phases,
  players,
  phaseId,
  initialName = '',
  onCreated,
  readOnly: readOnlyProp = false,
}: GmCodexManagerProps) {
  const { settings, isLoading } = useGmSettings(gameId);
  const readOnly = useBoardReadOnly() || readOnlyProp;
  const store = useGmSettingsStore(gameId, { readOnly });
  const { showToast } = useToast();
  const [open, setOpen] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const [type, setType] = useState<CodexType>('Location');
  const [name, setName] = useState(initialName);
  const [aliases, setAliases] = useState('');
  const [thisPhaseOnly, setThisPhaseOnly] = useState(phaseId !== undefined);

  if (isLoading || !settings) {
    return (
      <div className="flex justify-center py-8">
        <Spinner />
      </div>
    );
  }

  const phaseTitle = (id: number) => phases.find((p) => p.id === id)?.title ?? `Phase ${id}`;
  const scopeLabel = (e: CodexEntry) => (e.phases.length ? e.phases.map(phaseTitle).join(', ') : 'Every phase');
  const shown = phaseId === undefined || showAll ? settings.codex : settings.codex.filter((e) => inPhase(e, phaseId));
  const hidden = settings.codex.length - shown.length;

  const save = (entry: CodexEntry) => store.update('codex', entry.id, () => codexDoc(entry));
  const change = (id: string, fields: Partial<CodexEntry>) =>
    store.update<Omit<CodexEntry, 'id'>>('codex', id, (current) => ({ ...(current as Omit<CodexEntry, 'id'>), ...fields }));

  const add = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    const entry = newCodexEntry({
      id: newItemKey('cx'),
      type,
      name: name.trim(),
      aliases: splitList(aliases),
      phases: thisPhaseOnly && phaseId !== undefined ? [phaseId] : [],
    });
    save(entry);
    setName('');
    setAliases('');
    onCreated?.(entry);
  };

  const remove = (entry: CodexEntry) => {
    store.remove('codex', entry.id);
    setOpen(null);
    const hint = entry.type === 'Location' ? ' Cards placed there will need a new location.' : '';
    showToast(`Deleted “${entry.name}”.${hint}`, 'info', { action: { label: 'Undo', onClick: () => save(entry) } });
  };

  return (
    <div className="space-y-6" data-testid="gm-codex">
      {!readOnly && (
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
      )}

      {phaseId !== undefined && (hidden > 0 || showAll) && (
        <Checkbox
          id="codex-show-all"
          label={`Show entries for other phases${hidden ? ` (${hidden} hidden)` : ''}`}
          checked={showAll}
          onChange={(e) => setShowAll(e.target.checked)}
        />
      )}

      {shown.length === 0 ? (
        <p className="text-sm text-content-secondary">
          The codex is empty. Add the places first: locations become the rows of the board’s map.
        </p>
      ) : (
        <ul className="divide-y divide-theme-default rounded-lg border border-theme-default" aria-label="Codex entries">
          {shown.map((e) => (
            <li key={e.id} className="p-3" data-testid={`codex-entry-${e.id}`}>
              <div className="flex items-start gap-3">
                <Badge variant={codexTone(e)}>{e.type}</Badge>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-content-primary">
                    {e.name || '(no name)'}
                    {e.secret && e.type !== 'Secret' && (
                      <Badge variant="danger" size="sm" className="ml-2">
                        Secret
                      </Badge>
                    )}
                  </p>
                  <p className="text-sm text-content-secondary">
                    {scopeLabel(e)}
                    {e.aliases.length > 0 && <> · also {e.aliases.join(', ')}</>}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  aria-expanded={open === e.id}
                  aria-label={`${open === e.id ? 'Close' : readOnly ? 'View' : 'Edit'} ${e.name}`}
                  onClick={() => setOpen(open === e.id ? null : e.id)}
                >
                  {open === e.id ? 'Close' : readOnly ? 'View' : 'Edit'}
                </Button>
              </div>
              {open === e.id && (
                <div className="mt-4">
                  <CodexEntryEditor
                    entry={e}
                    phases={phases}
                    players={players}
                    readOnly={readOnly}
                    onChange={(fields) => change(e.id, fields)}
                    onDelete={() => remove(e)}
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
