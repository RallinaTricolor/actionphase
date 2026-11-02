import { Button, Checkbox, Input, Select, Textarea } from '@/components/ui';
import { useBoundText } from '@/hooks/useBoundText';
import { CODEX_TYPES } from '@/lib/gmBoard/codex';
import { splitList } from '@/lib/gmBoard/text';
import type { CodexEntry, CodexType } from '@/lib/gmBoard/types';

export interface CodexPhase {
  id: number;
  title: string;
}

export interface CodexCharacter {
  id: number;
  name: string;
}

interface CodexEntryEditorProps {
  entry: CodexEntry;
  /** The game's action phases, for "Applies to". */
  phases: CodexPhase[];
  /** The player characters, for a secret's "Allowed to know". */
  players: CodexCharacter[];
  onChange: (fields: Partial<CodexEntry>) => void;
  onDelete: () => void;
  readOnly?: boolean;
}

/** Edits one codex entry. Every change saves as it's made; text boxes keep their text while focused. */
export function CodexEntryEditor({ entry, phases, players, onChange, onDelete, readOnly = false }: CodexEntryEditorProps) {
  const name = useBoundText(entry.name);
  const aliases = useBoundText(entry.aliases.join(', '));
  const notes = useBoundText(entry.notes);
  const field = (suffix: string) => `codex-${entry.id}-${suffix}`;
  const everyPhase = entry.phases.length === 0;

  const togglePhase = (phaseId: number, on: boolean) =>
    onChange({ phases: on ? [...entry.phases, phaseId] : entry.phases.filter((p) => p !== phaseId) });
  const toggleKnown = (characterId: number, on: boolean) =>
    onChange({ knownBy: on ? [...entry.knownBy, characterId] : entry.knownBy.filter((c) => c !== characterId) });

  return (
    <div className="space-y-4" data-testid={`codex-editor-${entry.id}`}>
      <div className="grid grid-cols-1 sm:grid-cols-[10rem_1fr] gap-3">
        <Select
          id={field('type')}
          label="Type"
          value={entry.type}
          disabled={readOnly}
          onChange={(e) => onChange({ type: e.target.value as CodexType })}
        >
          {CODEX_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </Select>
        <Input
          id={field('name')}
          label="Name"
          value={name.text}
          readOnly={readOnly}
          {...name.bind}
          onChange={(e) => {
            name.setText(e.target.value);
            if (e.target.value.trim()) onChange({ name: e.target.value.trim() });
          }}
          error={name.text.trim() ? undefined : 'An entry needs a name.'}
        />
      </div>
      <Input
        id={field('aliases')}
        label="Other names"
        helperText="Comma separated. Matched in any case, as whole words."
        value={aliases.text}
        readOnly={readOnly}
        {...aliases.bind}
        onChange={(e) => {
          aliases.setText(e.target.value);
          onChange({ aliases: splitList(e.target.value) });
        }}
      />
      <Textarea
        id={field('notes')}
        label="GM notes"
        rows={3}
        value={notes.text}
        readOnly={readOnly}
        {...notes.bind}
        onChange={(e) => {
          notes.setText(e.target.value);
          onChange({ notes: e.target.value });
        }}
      />

      <fieldset>
        <legend className="block text-sm font-medium text-content-primary mb-2">Applies to</legend>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          <Checkbox
            id={field('every')}
            label="Every phase"
            checked={everyPhase}
            disabled={readOnly || everyPhase}
            onChange={() => onChange({ phases: [] })}
          />
          {phases.map((p) => (
            <Checkbox
              key={p.id}
              id={field(`phase-${p.id}`)}
              label={p.title}
              checked={entry.phases.includes(p.id)}
              disabled={readOnly}
              onChange={(e) => togglePhase(p.id, e.target.checked)}
            />
          ))}
        </div>
      </fieldset>

      <Checkbox
        id={field('secret')}
        label="Secret"
        helperText="The checks before publishing warn when a secret shows up in a result."
        checked={entry.secret}
        disabled={readOnly}
        onChange={(e) => onChange({ secret: e.target.checked })}
      />
      {entry.secret && players.length > 0 && (
        <fieldset>
          <legend className="block text-sm font-medium text-content-primary mb-1">Allowed to know</legend>
          <p className="text-sm text-content-secondary mb-2">No warning when it shows up in these characters’ results.</p>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {players.map((c) => (
              <Checkbox
                key={c.id}
                id={field(`known-${c.id}`)}
                label={c.name}
                checked={entry.knownBy.includes(c.id)}
                disabled={readOnly}
                onChange={(e) => toggleKnown(c.id, e.target.checked)}
              />
            ))}
          </div>
        </fieldset>
      )}

      {!readOnly && (
        <div className="flex justify-end">
          <Button type="button" variant="danger" size="sm" onClick={onDelete}>
            Delete entry
          </Button>
        </div>
      )}
    </div>
  );
}
