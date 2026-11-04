import { Button, Input, Spinner } from '@/components/ui';
import { useBoundText } from '@/hooks/useBoundText';
import { useGmSettings, useGmSettingsStore } from '@/hooks/useGmBoard';
import { useBoardReadOnly } from '@/hooks/useBoardReadOnly';
import { characterNames, defaultNames, splitList } from '@/lib/gmBoard/text';

interface NamedCharacterRow {
  id: number;
  name: string;
  npc: boolean;
}

interface GmCharacterNamesProps {
  gameId: number;
  characters: NamedCharacterRow[];
  readOnly?: boolean;
}

/**
 * The names the board knows each character by: highlighted in submissions,
 * and used by the coverage check, the leak check and "Make 'you'". Each
 * defaults to the full name plus the first word; a list the GM sets replaces
 * it, and an empty list turns matching off for that character.
 */
export function GmCharacterNames({ gameId, characters, readOnly: readOnlyProp = false }: GmCharacterNamesProps) {
  const readOnly = useBoardReadOnly() || readOnlyProp;
  const { settings, isLoading } = useGmSettings(gameId);
  const store = useGmSettingsStore(gameId, { readOnly });

  if (isLoading || !settings) {
    return (
      <div className="flex justify-center py-8">
        <Spinner />
      </div>
    );
  }
  if (!characters.length) {
    return <p className="text-sm text-content-secondary">No characters yet.</p>;
  }

  return (
    <div className="space-y-3" data-testid="gm-character-names">
      <p className="text-sm text-content-secondary">
        Comma separated, matched with the same capitals. Leave a character’s list empty to stop matching them.
      </p>
      {characters.map((c) => (
        <NamesRow
          key={c.id}
          character={c}
          names={characterNames(settings.names, c.id, c.name)}
          custom={Object.prototype.hasOwnProperty.call(settings.names, c.id)}
          readOnly={readOnly}
          onChange={(names) => store.update('names', String(c.id), () => ({ names }))}
          onReset={() => store.remove('names', String(c.id))}
        />
      ))}
    </div>
  );
}

function NamesRow({
  character,
  names,
  custom,
  readOnly,
  onChange,
  onReset,
}: {
  character: NamedCharacterRow;
  names: string[];
  custom: boolean;
  readOnly: boolean;
  onChange: (names: string[]) => void;
  onReset: () => void;
}) {
  const box = useBoundText(names.join(', '));
  return (
    <div className="flex items-end gap-2">
      <Input
        id={`names-${character.id}`}
        label={character.npc ? `${character.name} (NPC)` : character.name}
        placeholder="Not matched"
        value={box.text}
        readOnly={readOnly}
        {...box.bind}
        onChange={(e) => {
          box.setText(e.target.value);
          onChange(splitList(e.target.value));
        }}
      />
      {custom && !readOnly ? (
        <Button type="button" size="sm" variant="ghost" onClick={onReset} title={`Default: ${defaultNames(character.name).join(', ')}`}>
          Use default
        </Button>
      ) : null}
    </div>
  );
}
