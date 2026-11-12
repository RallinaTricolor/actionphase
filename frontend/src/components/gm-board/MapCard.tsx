import { memo } from 'react';
import { Badge, Button } from '@/components/ui';
import CharacterAvatar from '@/components/characters/CharacterAvatar';
import { boardLabel, isIF, isWaiting, OUTCOMES, shownCondition } from '@/lib/gmBoard/cards';
import type { CastMember } from '@/lib/gmBoard/cast';
import { shortName, truncate } from '@/lib/gmBoard/text';
import type { Card } from '@/lib/gmBoard/types';

interface MapCardProps {
  card: Card;
  owner: CastMember | undefined;
  /** The names the board knows the owner by, for trimming the label. */
  ownerNames: string[];
  /** Played by someone out of play. */
  flagged?: boolean;
  dragging?: boolean;
  onOpen: (id: string) => void;
  onDragStart?: (id: string) => void;
  onDragEnd?: () => void;
}

/**
 * A card on the Map: who, its label, its IF condition and outcome. Click (or
 * Enter) opens it; dragging moves it. Its left edge shows the outcome.
 */
export const MapCard = memo(function MapCard({ card, owner, ownerNames, flagged, dragging, onOpen, onDragStart, onDragEnd }: MapCardProps) {
  const name = owner?.name ?? `Character ${card.characterId}`;
  const label = boardLabel(card, [name, ...ownerNames]);
  const cond = shownCondition(card, label);
  const waiting = isWaiting(card);
  const outcome = OUTCOMES.find((o) => o.value === card.outcome) ?? OUTCOMES[0];
  const status = waiting ? 'Waiting' : outcome.label;
  const title = [
    `${name}${isIF(card) ? ` · IF ${card.cond || '…'}` : ''} · ${status}`,
    truncate(card.quote || card.summary, 500),
    card.note ? `GM note: ${card.note}` : '',
  ].filter(Boolean).join('\n');

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      draggable={!!onDragStart}
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', card.id);
        e.dataTransfer.effectAllowed = 'move';
        onDragStart?.(card.id);
      }}
      onDragEnd={onDragEnd}
      onClick={() => onOpen(card.id)}
      title={title}
      aria-label={`${name}: ${label}${/[.!?…]$/.test(label) ? '' : '.'} ${status}${flagged ? ', out of play' : ''}`}
      data-testid={`map-card-${card.id}`}
      data-arrow-id={card.id}
      data-card-id={card.id}
      className={[
        'w-full !justify-start !items-start !text-left !px-2 !py-1 border border-l-4 surface-base',
        flagged ? 'border-semantic-danger' : 'border-theme-default',
        `gm-edge-${waiting ? 'waiting' : outcome.tone}`,
        card.outcome === 'moot' ? 'opacity-60' : '',
        dragging ? 'opacity-40' : '',
      ].join(' ')}
    >
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="flex items-center gap-1 text-xs text-content-secondary">
          <CharacterAvatar avatarUrl={owner?.avatarUrl} characterName={name} size="xs" />
          <span className="truncate font-medium">{shortName(name)}</span>
          {isIF(card) && (
            <Badge variant="primary" size="sm">
              IF
            </Badge>
          )}
          {card.gm && <Badge size="sm">GM</Badge>}
          {card.note && <span aria-hidden="true">✎</span>}
          {!waiting && card.outcome !== 'pending' && (
            <Badge variant={outcome.tone} size="sm">
              {outcome.label}
            </Badge>
          )}
        </span>
        <span className="line-clamp-3 text-sm text-content-primary">
          {cond && <span className="text-interactive-primary">{cond}: </span>}
          {label}
        </span>
      </span>
    </Button>
  );
});
