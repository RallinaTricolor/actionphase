import { useState } from 'react';
import { Badge, Button } from '@/components/ui';
import type { BoardFlag } from '@/lib/gmBoard/flags';
import { flagCardId, flagSentence } from './mapModel';
import type { MapModel } from './mapTypes';

interface MapChecksProps {
  model: MapModel;
  onOpenCard: (id: string) => void;
  onResolveAt: (chunkId: string) => void;
  onDismiss: (flag: BoardFlag) => void;
  onRestore: (flag: BoardFlag) => void;
  onCreateScene: (locationId: string, chunkId: string) => void;
  onOpenScene: (sceneId: string) => void;
  /** Checks to read: no dismiss or restore, and no creating scenes. */
  readOnly?: boolean;
}

const KIND_LABEL: Record<BoardFlag['kind'], string> = {
  out: 'Out of play',
  two: 'Two places',
  meeting: 'No scene',
  pending: 'No outcome',
};

/** Things on the board that are probably mistakes. Each can be dismissed (and restored). */
export function MapChecks({ model, onOpenCard, onResolveAt, onDismiss, onRestore, onCreateScene, onOpenScene, readOnly = false }: MapChecksProps) {
  const go = { onOpenCard, onResolveAt, onCreateScene, onOpenScene, readOnly };
  const [showDismissed, setShowDismissed] = useState(false);
  const dismissed = model.flags.filter((f) => model.board.dismissedFlags[f.key]);
  return (
    <section aria-label="Checks" className="space-y-2" data-testid="map-checks">
      {model.open.length === 0 ? (
        <p className="text-sm text-content-secondary">Nothing to check.</p>
      ) : (
        <ul className="space-y-1.5">
          {model.open.map((flag) => (
            <FlagRow key={flag.key} flag={flag} model={model} {...go}>
              <Button type="button" variant="ghost" size="sm" onClick={() => onDismiss(flag)} aria-label={`Dismiss: ${flagSentence(flag, model)}`}>
                Dismiss
              </Button>
            </FlagRow>
          ))}
        </ul>
      )}
      {dismissed.length > 0 && (
        <div>
          <Button type="button" variant="ghost" size="sm" onClick={() => setShowDismissed((v) => !v)} aria-expanded={showDismissed}>
            {showDismissed ? '▾' : '▸'} Dismissed ({dismissed.length})
          </Button>
          {showDismissed && (
            <ul className="space-y-1.5 opacity-75">
              {dismissed.map((flag) => (
                <FlagRow key={flag.key} flag={flag} model={model} {...go}>
                  <Button type="button" variant="ghost" size="sm" onClick={() => onRestore(flag)} aria-label={`Restore: ${flagSentence(flag, model)}`}>
                    Restore
                  </Button>
                </FlagRow>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

interface FlagRowProps extends Pick<MapChecksProps, 'onOpenCard' | 'onResolveAt' | 'onCreateScene' | 'onOpenScene' | 'readOnly'> {
  flag: BoardFlag;
  model: MapModel;
  children: React.ReactNode;
}

function FlagRow({ flag, model, onOpenCard, onResolveAt, onCreateScene, onOpenScene, readOnly, children }: FlagRowProps) {
  const cardId = flagCardId(flag);
  const sceneId = flag.kind === 'out' ? flag.sceneId : undefined;
  return (
    <li className="space-y-1 rounded border border-theme-default surface-base p-2 text-sm">
      <div className="text-content-primary">
        <Badge variant={flag.kind === 'pending' ? 'neutral' : 'warning'} size="sm" className="mr-1.5">
          {KIND_LABEL[flag.kind]}
        </Badge>
        {flagSentence(flag, model)}
      </div>
      <div className="flex justify-end gap-1">
        {flag.kind === 'meeting' ? (
          !readOnly && (
            <Button type="button" variant="ghost" size="sm" onClick={() => onCreateScene(flag.locationId, flag.chunkId)}>
              Create scene
            </Button>
          )
        ) : sceneId ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => onOpenScene(sceneId)}>
            Open scene
          </Button>
        ) : cardId ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => onOpenCard(cardId)}>
            Open card
          </Button>
        ) : (
          !readOnly && (
            <Button type="button" variant="ghost" size="sm" onClick={() => onResolveAt(flag.chunkId)}>
              Show
            </Button>
          )
        )}
        {!readOnly && children}
      </div>
    </li>
  );
}
