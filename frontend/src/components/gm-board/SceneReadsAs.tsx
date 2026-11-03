import { useState } from 'react';
import { Badge, Button, Checkbox } from '@/components/ui';
import CharacterAvatar from '@/components/characters/CharacterAvatar';
import { isNote, missReason, readerVersion } from '@/lib/gmBoard/moments';
import type { Moment } from '@/lib/gmBoard/types';
import { wordCount } from '@/lib/gmBoard/scenes';
import { shortName } from '@/lib/gmBoard/text';
import { MISS_TEXT } from './sceneText';
import type { SceneModel } from './sceneTypes';
import { YouKey } from './YouKey';
import { YouText } from './YouText';

interface SceneReadsAsProps {
  model: SceneModel;
  reader: number | null;
  onReader: (characterId: number) => void;
  focusedId: string | null;
  onFocusMoment: (momentId: string) => void;
  onCopy: (text: string) => void;
  /** Whether the reader's results already cover a moment (text match or tick). */
  inDraft: (moment: Moment, characterId: number) => boolean;
  /** Adds these moments, as this reader gets them, to the end of their draft and ticks them covered. */
  onAddToDraft: (characterId: number, moments: Moment[], text: string) => void;
  adding?: boolean;
  onWrite: (characterId: number) => void;
}

/**
 * The scene as one reader gets it: the moments they're ticked on, their own
 * version where they have one, in second person when that's on.
 */
export function SceneReadsAs({ model, reader, onReader, focusedId, onFocusMoment, onCopy, inDraft, onAddToDraft, adding = false, onWrite }: SceneReadsAsProps) {
  const [showMisses, setShowMisses] = useState(false);
  const { scene, readers } = model;
  const x = reader !== null && readers.includes(reader) ? reader : (readers[0] ?? null);

  if (x === null) {
    return (
      <section aria-label="Reads as" className="space-y-2">
        <h3 className="text-sm font-semibold text-content-primary">Reads as</h3>
        <p className="text-sm text-content-secondary">Nobody in this scene reads results yet.</p>
      </section>
    );
  }

  const name = shortName(model.names.get(x) ?? `Character ${x}`);
  const versions = scene.moments.map((m) => ({
    moment: m,
    miss: missReason(m, scene, x),
    version: readerVersion(m, x, model.nameLists.get(x) ?? [], model.secondPerson),
  }));
  const got = versions.filter((v) => v.miss === null);
  const text = got.map((v) => v.version.text.trim()).join('\n\n');
  const todo = got.filter((v) => !inDraft(v.moment, x));

  return (
    <section aria-label="Reads as" className="space-y-3" data-testid="scene-reads-as">
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-content-primary">Reads as</h3>
        <div className="flex flex-wrap gap-1" role="group" aria-label="Reader">
          {readers.map((id) => {
            const n = shortName(model.names.get(id) ?? `Character ${id}`);
            return (
              <Button key={id} type="button" size="sm" variant={id === x ? 'primary' : 'secondary'} aria-pressed={id === x} className="gap-1" onClick={() => onReader(id)}>
                <CharacterAvatar avatarUrl={model.cast.get(id)?.avatarUrl} characterName={n} size="xs" />
                {n}
              </Button>
            );
          })}
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 text-xs text-content-tertiary">
        <Checkbox id="scene-show-misses" label={`Show what ${name} misses`} checked={showMisses} onChange={(e) => setShowMisses(e.target.checked)} />
        <span>{wordCount(text)} words</span>
      </div>

      <div className="space-y-1">
        {versions.map(({ moment, miss, version }, i) => {
          if (miss !== null && (!showMisses || isNote(moment))) return null;
          return (
            <Button
              key={moment.id}
              type="button"
              variant="ghost"
              size="sm"
              className={`!block w-full !whitespace-normal rounded !px-2 !py-1.5 text-left !font-normal ${focusedId === moment.id ? 'surface-raised' : ''}`}
              onClick={() => onFocusMoment(moment.id)}
              data-testid={`reads-as-${moment.id}`}
            >
              <span className="mr-1 text-xs text-content-tertiary">{i + 1}</span>
              {miss === null ? (
                <>
                  <span className="text-content-primary">
                    <YouText result={version} />
                  </span>
                  {typeof moment.ownText[x] === 'string' && moment.ownText[x].trim() && (
                    <>
                      {' '}
                      <Badge variant="primary" size="sm">
                        own
                      </Badge>
                    </>
                  )}
                  {inDraft(moment, x) && (
                    <>
                      {' '}
                      <Badge variant="success" size="sm">
                        in draft
                      </Badge>
                    </>
                  )}
                </>
              ) : (
                <span className="text-content-tertiary">{MISS_TEXT[miss]}</span>
              )}
            </Button>
          );
        })}
        {!got.length && !showMisses && <p className="text-sm text-content-secondary">{name} doesn’t get anything here yet.</p>}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="primary"
          disabled={!todo.length || adding}
          onClick={() => onAddToDraft(x, todo.map((v) => v.moment), todo.map((v) => v.version.text.trim()).join('\n\n'))}
          title={`Adds them to the end of the result part you last picked for ${name}, or starts their result`}
        >
          {todo.length
            ? `Add ${todo.length} moment${todo.length === 1 ? '' : 's'} to ${name}’s draft`
            : got.length
              ? `All in ${name}’s draft`
              : 'Nothing to add'}
        </Button>
        <Button type="button" size="sm" variant="secondary" disabled={!got.length} onClick={() => onCopy(text)}>
          Copy {name}’s version
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => onWrite(x)}>
          Write {name}’s result →
        </Button>
      </div>
      {model.secondPerson && <YouKey />}
    </section>
  );
}
