import { Button, Select } from '@/components/ui';
import CharacterAvatar from '@/components/characters/CharacterAvatar';
import { reads } from '@/lib/gmBoard/moments';
import { shortName } from '@/lib/gmBoard/text';
import type { Moment } from '@/lib/gmBoard/types';
import type { SceneModel } from './sceneTypes';

interface ReaderChipsProps {
  moment: Moment;
  /** The moment's number in the scene, for labels. */
  number: number;
  model: SceneModel;
  onToggle: (characterId: number, on: boolean) => void;
  /** Starts this reader's own version. */
  onOwnText: (characterId: number) => void;
  onAddElsewhere: (characterId: number) => void;
}

/**
 * Who reads a moment: one toggle per reader of the scene (✓ shared text,
 * ✎ their own version, – not ticked), a ✎ beside each ticked reader to give
 * them their own version, and "+ someone elsewhere" for a reader outside the
 * scene who sees or hears it.
 */
export function ReaderChips({ moment, number, model, onToggle, onOwnText, onAddElsewhere }: ReaderChipsProps) {
  const { scene } = model;
  const elsewhere = [...model.cast.values()].filter(
    (c) => model.canRead(c.id) && !scene.participants.includes(c.id) && !reads(moment, c.id),
  );

  return (
    <div className="flex flex-wrap items-center gap-1" role="group" aria-label={`Who reads moment ${number}`}>
      {model.readers.map((id) => {
        const on = reads(moment, id);
        const own = on && typeof moment.ownText[id] === 'string';
        const far = !scene.participants.includes(id);
        const name = shortName(model.names.get(id) ?? `Character ${id}`);
        return (
          <span key={id} className="inline-flex items-center">
            <Button
              type="button"
              size="sm"
              variant={on ? 'primary' : 'outline'}
              className="!px-2 !py-0.5 gap-1 text-xs"
              aria-pressed={on}
              aria-label={name}
              title={`${name} ${on ? (own ? 'reads their own version' : 'reads the shared text') : 'doesn’t read this'}. Click to ${on ? 'untick' : 'tick'}.`}
              onClick={() => onToggle(id, !on)}
            >
              <CharacterAvatar avatarUrl={model.cast.get(id)?.avatarUrl} characterName={name} size="xs" />
              <span aria-hidden="true">{on ? (own ? '✎' : '✓') : '–'}</span>
              {name}
              {far && <span className="opacity-75">· elsewhere</span>}
            </Button>
            {on && !own && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="!px-1 !py-0 text-xs"
                title={`Give ${name} their own version of this moment`}
                aria-label={`Own version for ${name}`}
                onClick={() => onOwnText(id)}
              >
                ✎
              </Button>
            )}
          </span>
        );
      })}
      {elsewhere.length > 0 && (
        <div>
          <Select
            id={`moment-${moment.id}-elsewhere`}
            aria-label="Also tell someone elsewhere"
            title="Someone outside the scene who sees or hears this"
            selectSize="sm"
            value=""
            onChange={(e) => e.target.value && onAddElsewhere(Number(e.target.value))}
          >
            <option value="">+ someone elsewhere</option>
            {elsewhere.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
      )}
    </div>
  );
}
