import { useState } from 'react';
import { Badge, Button, Checkbox, Select, Spinner } from '@/components/ui';
import { useToast } from '@/contexts/ToastContext';
import { useGmSettings, useGmSettingsStore } from '@/hooks/useGmBoard';
import { useBoardReadOnly } from '@/hooks/useBoardReadOnly';
import { codexDoc, codexTone, inPhase } from '@/lib/gmBoard/codex';
import type { CodexEntry } from '@/lib/gmBoard/types';
import { CodexAddForm } from './CodexAddForm';
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
  /** On Game setup: the phase new locations and objectives start as (the current one). */
  defaultPhaseId?: number;
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
 * board's Codex tab; both edit the same settings.
 */
export function GmCodexManager({
  gameId,
  phases,
  players,
  phaseId,
  defaultPhaseId,
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
  // Game setup's "Show": '' everything, 'every' the every-phase entries, else a phase id.
  const [filter, setFilter] = useState('');

  if (isLoading || !settings) {
    return (
      <div className="flex justify-center py-8">
        <Spinner />
      </div>
    );
  }

  const phaseTitle = (id: number) => phases.find((p) => p.id === id)?.title ?? `Phase ${id}`;
  const scopeLabel = (e: CodexEntry) => (e.phases.length ? e.phases.map(phaseTitle).join(', ') : 'Every phase');
  // The phase being worked on: the board's, or the one Game setup is showing.
  const focus = phaseId ?? (filter && filter !== 'every' ? Number(filter) : undefined);
  const shown =
    phaseId !== undefined
      ? showAll
        ? settings.codex
        : settings.codex.filter((e) => inPhase(e, phaseId))
      : filter === 'every'
        ? settings.codex.filter((e) => !e.phases.length)
        : focus !== undefined
          ? settings.codex.filter((e) => inPhase(e, focus))
          : settings.codex;
  const hidden = settings.codex.length - shown.length;
  const countIn = (id: number) => settings.codex.filter((e) => inPhase(e, id)).length;

  const save = (entry: CodexEntry) => store.update('codex', entry.id, () => codexDoc(entry));
  const change = (id: string, fields: Partial<CodexEntry>) =>
    store.update<Omit<CodexEntry, 'id'>>('codex', id, (current) => ({ ...(current as Omit<CodexEntry, 'id'>), ...fields }));

  const remove = (entry: CodexEntry) => {
    store.remove('codex', entry.id);
    setOpen(null);
    const hint = entry.type === 'Location' ? ' Cards placed there will need a new location.' : '';
    showToast(`Deleted “${entry.name}”.${hint}`, 'info', { action: { label: 'Undo', onClick: () => save(entry) } });
  };

  /**
   * Takes an entry other phases use off this phase only, so deleting isn't
   * the only way to clear a reused place from a Map. An every-phase entry
   * keeps every other phase.
   */
  const removeFromPhase = (e: CodexEntry) => {
    if (focus === undefined || !inPhase(e, focus)) return undefined;
    const rest = (e.phases.length ? e.phases : phases.map((p) => p.id)).filter((p) => p !== focus);
    if (!rest.length) return undefined;
    return {
      label: `Remove from ${phaseTitle(focus)}`,
      onRemove: () => {
        change(e.id, { phases: rest });
        setOpen(null);
        showToast(`Removed “${e.name}” from ${phaseTitle(focus)}.`, 'info', { action: { label: 'Undo', onClick: () => change(e.id, { phases: e.phases }) } });
      },
    };
  };

  return (
    <div className="space-y-6" data-testid="gm-codex">
      {!readOnly && (
        <CodexAddForm
          phases={phases}
          phaseId={focus ?? defaultPhaseId}
          initialName={initialName}
          onAdd={(entry) => {
            save(entry);
            onCreated?.(entry);
          }}
        />
      )}

      {phaseId === undefined && phases.length > 0 && settings.codex.length > 0 && (
        <div className="w-72">
          <Select id="codex-filter" label="Show" selectSize="sm" value={filter} onChange={(e) => setFilter(e.target.value)} data-testid="codex-filter">
            <option value="">Everything ({settings.codex.length})</option>
            <option value="every">Every-phase entries ({settings.codex.filter((e) => !e.phases.length).length})</option>
            {phases.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title} ({countIn(p.id)})
              </option>
            ))}
          </Select>
        </div>
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
          {settings.codex.length
            ? 'Nothing here yet.'
            : 'The codex is empty. Add the places first: locations become the rows of the board’s map.'}
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
                    removeFromPhase={readOnly ? undefined : removeFromPhase(e)}
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
