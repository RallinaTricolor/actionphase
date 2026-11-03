import { Badge, Button } from '@/components/ui';
import type { PublishChecks } from '@/lib/gmBoard/checks';
import type { Leak } from '@/lib/gmBoard/leaks';
import { readerText } from '@/lib/gmBoard/moments';
import { shortName, truncate } from '@/lib/gmBoard/text';
import { flagSentence } from './mapModel';
import type { MapModel } from './mapTypes';
import type { WriteModel } from './writeTypes';

interface WriteChecksProps {
  model: WriteModel;
  characterId: number;
  checks: PublishChecks;
  /** For the flag sentences: the board's location rows. */
  rows: MapModel['rows'];
  onOpenScene: (sceneId: string) => void;
  onDismissFlag: (key: string) => void;
}

/**
 * Checks before publishing one character's results: possible leaks, their
 * out-of-play and two-places flags, and the moments they read that no
 * result covers yet. Warnings, not rules.
 */
export function WriteChecks({ model, characterId, checks, rows, onOpenScene, onDismissFlag }: WriteChecksProps) {
  const name = shortName(model.names.get(characterId) ?? `Character ${characterId}`);
  const who = (id: number) => shortName(model.names.get(id) ?? `Character ${id}`);

  const why = (leak: Leak) => {
    switch (leak.reason.kind) {
      case 'secret':
        return `a secret (${leak.reason.entryName}) ${name} isn’t on the list to know`;
      case 'hidden': {
        const { sceneId } = leak.reason;
        const scene = model.board.scenes.find((s) => s.id === sceneId);
        return (
          <>
            from a moment {name} doesn’t read{scene ? ' in ' : ''}
            {scene && (
              <Button type="button" variant="ghost" size="sm" className="!px-1 !py-0 underline" onClick={() => onOpenScene(sceneId)}>
                {model.sceneName(scene)}
              </Button>
            )}
          </>
        );
      }
      case 'sheet':
        return `on ${who(leak.reason.characterId)}’s sheet (${leak.reason.tabLabel}), not ${name}’s`;
    }
  };

  return (
    <section aria-label="Checks before publishing" className="space-y-2" data-testid="write-checks">
      <h3 className="text-sm font-semibold text-content-primary">Checks before publishing</h3>
      {checks.clear ? (
        <p className="text-sm text-content-secondary">No leaks, every moment covered, nothing out of place.</p>
      ) : (
        <ul className="space-y-1.5 text-sm">
          {checks.leaks.map((leak) => (
            <li key={`leak-${leak.term}`} className="flex flex-wrap items-baseline gap-1.5" data-testid="write-check-leak">
              <Badge variant="danger" size="sm">
                Possible leak
              </Badge>
              <span className="text-content-primary">
                <b>“{leak.term}”</b>: {why(leak)}
              </span>
            </li>
          ))}
          {checks.flags.map((flag) => (
            <li key={flag.key} className="flex flex-wrap items-baseline gap-1.5">
              <Badge variant="danger" size="sm">
                {flag.kind === 'out' ? 'Out of play' : 'Two places'}
              </Badge>
              <span className="flex-1 text-content-primary">{flagSentence(flag, { board: model.board, names: model.names, rows })}</span>
              <Button type="button" variant="ghost" size="sm" onClick={() => onDismissFlag(flag.key)}>
                Dismiss
              </Button>
            </li>
          ))}
          {checks.notCovered.length > 0 && (
            <li>
              <details>
                <summary className="cursor-pointer">
                  <Badge variant="warning" size="sm">
                    {checks.notCovered.length} not covered
                  </Badge>{' '}
                  <span className="text-content-secondary">moments {name} reads that no result mentions yet</span>
                </summary>
                <ul className="mt-1 space-y-0.5 pl-4 text-xs text-content-secondary">
                  {checks.notCovered.map((m) => (
                    <li key={m.id}>• {truncate(readerText(m, characterId, model.nameLists.get(characterId) ?? [], model.secondPerson), 140)}</li>
                  ))}
                </ul>
              </details>
            </li>
          )}
        </ul>
      )}
    </section>
  );
}
