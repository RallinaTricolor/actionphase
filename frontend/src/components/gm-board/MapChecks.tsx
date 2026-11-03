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
}

const KIND_LABEL: Record<BoardFlag['kind'], string> = {
  out: 'Out of play',
  two: 'Two places',
  meeting: 'No scene',
  pending: 'No outcome',
};

/** Things on the board that are probably mistakes. Each can be dismissed (and restored). */
export function MapChecks({ model, onOpenCard, onResolveAt, onDismiss, onRestore }: MapChecksProps) {
  const [showDismissed, setShowDismissed] = useState(false);
  const dismissed = model.flags.filter((f) => model.board.dismissedFlags[f.key]);
  return (
    <section aria-label="Checks" className="space-y-2" data-testid="map-checks">
      <h3 className="text-sm font-semibold text-content-primary">
        Checks {model.open.length > 0 && <Badge variant="warning" size="sm">{model.open.length}</Badge>}
      </h3>
      {model.open.length === 0 ? (
        <p className="text-sm text-content-secondary">Nothing to check.</p>
      ) : (
        <ul className="space-y-1.5">
          {model.open.map((flag) => (
            <FlagRow key={flag.key} flag={flag} model={model} onOpenCard={onOpenCard} onResolveAt={onResolveAt}>
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
                <FlagRow key={flag.key} flag={flag} model={model} onOpenCard={onOpenCard} onResolveAt={onResolveAt}>
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

interface FlagRowProps {
  flag: BoardFlag;
  model: MapModel;
  onOpenCard: (id: string) => void;
  onResolveAt: (chunkId: string) => void;
  children: React.ReactNode;
}

function FlagRow({ flag, model, onOpenCard, onResolveAt, children }: FlagRowProps) {
  const cardId = flagCardId(flag);
  return (
    <li className="space-y-1 rounded border border-theme-default surface-base p-2 text-sm">
      <div className="text-content-primary">
        <Badge variant={flag.kind === 'pending' ? 'neutral' : 'warning'} size="sm" className="mr-1.5">
          {KIND_LABEL[flag.kind]}
        </Badge>
        {flagSentence(flag, model)}
      </div>
      <div className="flex justify-end gap-1">
        <Button type="button" variant="ghost" size="sm" onClick={() => (cardId ? onOpenCard(cardId) : onResolveAt(flag.chunkId))}>
          {cardId ? 'Open card' : 'Show'}
        </Button>
        {children}
      </div>
    </li>
  );
}
