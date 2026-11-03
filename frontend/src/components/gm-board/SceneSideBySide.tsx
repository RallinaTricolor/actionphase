import { Button } from '@/components/ui';
import CharacterAvatar from '@/components/characters/CharacterAvatar';
import { isNote, missReason, readerVersion } from '@/lib/gmBoard/moments';
import { shortName, truncate } from '@/lib/gmBoard/text';
import { MISS_TEXT } from './sceneText';
import type { SceneModel } from './sceneTypes';
import { YouText } from './YouText';

interface SceneSideBySideProps {
  model: SceneModel;
  /** A cell was clicked: edit that moment, reading as that person. */
  onPick: (momentId: string, characterId: number) => void;
}

/** One column per reader and one row per moment: what each person gets, side by side. */
export function SceneSideBySide({ model, onPick }: SceneSideBySideProps) {
  const { scene, readers } = model;
  if (!readers.length) return <p className="text-sm text-content-secondary">Add players to the scene to compare their versions.</p>;
  if (!scene.moments.length) return <p className="text-sm text-content-secondary">No moments yet.</p>;

  return (
    <div className="space-y-2" data-testid="scene-side-by-side">
      <div className="overflow-x-auto rounded-lg border border-theme-default">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="surface-raised">
              <th scope="col" className="w-40 border-b border-theme-default p-2 text-left text-xs font-normal text-content-tertiary">
                Moment
              </th>
              {readers.map((id) => {
                const name = shortName(model.names.get(id) ?? `Character ${id}`);
                return (
                  <th key={id} scope="col" className="min-w-[12rem] border-b border-l border-theme-default p-2 text-left font-medium text-content-primary">
                    <span className="inline-flex items-center gap-1">
                      <CharacterAvatar avatarUrl={model.cast.get(id)?.avatarUrl} characterName={name} size="xs" />
                      {name}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {scene.moments.map((m, i) => (
              <tr key={m.id} className="align-top">
                <th scope="row" className="border-b border-theme-default p-2 text-left text-xs font-normal text-content-secondary">
                  <span className="mr-1 text-content-tertiary">{i + 1}</span>
                  {isNote(m) ? 'GM note: ' : ''}
                  {m.text.trim() ? truncate(m.text, 70) : <i>{Object.values(m.ownText).some((t) => t.trim()) ? 'only own versions' : 'nothing written yet'}</i>}
                </th>
                {readers.map((id) => {
                  const miss = missReason(m, scene, id);
                  const own = miss === null && !!m.ownText[id]?.trim();
                  return (
                    <td key={id} className={`border-b border-theme-default p-0 ${own ? 'border-l-4 gm-edge-waiting' : 'border-l'}`}>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="!block h-full w-full !whitespace-normal !rounded-none !p-2 text-left !font-normal"
                        title={miss === null ? (own ? 'Their own version' : 'Shared text') : undefined}
                        onClick={() => onPick(m.id, id)}
                        data-testid={`side-${m.id}-${id}`}
                      >
                        {miss === null ? (
                          <span className="text-content-primary">
                            <YouText result={readerVersion(m, id, model.nameLists.get(id) ?? [], model.secondPerson)} />
                          </span>
                        ) : (
                          <span className="text-xs text-content-tertiary">{MISS_TEXT[miss]}</span>
                        )}
                      </Button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-content-tertiary">
        Each column is one person’s scene, top to bottom. A coloured left edge: their own version. Click a cell to edit that moment.
      </p>
    </div>
  );
}
