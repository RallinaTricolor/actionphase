import { Badge, Button } from '@/components/ui';
import { TOOLBAR_LABEL } from './boardToolbarSlot';

interface ReadPlayer {
  id: number;
  name: string;
  /** Cards from their submission (GM cards don't count). */
  cards: number;
  readDone: boolean;
}

interface ReadPlayerListProps {
  players: ReadPlayer[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}

/**
 * The phase's submitters as a strip of chips in the Read step's toolbar, with
 * how many are read and how many cards each has given the board.
 */
export function ReadPlayerList({ players, selectedId, onSelect }: ReadPlayerListProps) {
  const read = players.filter((p) => p.readDone).length;
  return (
    <nav aria-label="Submissions" className="flex flex-wrap items-center gap-1.5" data-testid="read-player-list">
      <span className={`mr-1 ${TOOLBAR_LABEL}`}>
        {read}/{players.length} read
      </span>
      {players.map((p) => (
        <Button
          key={p.id}
          type="button"
          variant={p.id === selectedId ? 'primary' : 'outline'}
          size="sm"
          className="max-w-[14rem] gap-1.5"
          aria-current={p.id === selectedId ? 'true' : undefined}
          onClick={() => onSelect(p.id)}
        >
          <span className="truncate">{p.name}</span>
          {p.readDone && <span aria-label="read">✓</span>}
          <Badge variant={p.cards ? 'success' : 'neutral'} size="sm" title={`${p.readDone ? 'Read. ' : ''}${p.cards} card${p.cards === 1 ? '' : 's'} on the board`}>
            {p.cards}
          </Badge>
        </Button>
      ))}
    </nav>
  );
}
