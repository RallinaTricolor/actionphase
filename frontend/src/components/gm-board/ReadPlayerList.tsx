import { Badge, Button } from '@/components/ui';

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

/** The phase's submitters, with how many are read and how many cards each has given the board. */
export function ReadPlayerList({ players, selectedId, onSelect }: ReadPlayerListProps) {
  const read = players.filter((p) => p.readDone).length;
  return (
    <nav aria-label="Submissions" className="space-y-1" data-testid="read-player-list">
      <p className="px-2 pb-1 text-sm text-content-secondary">
        {read}/{players.length} read
      </p>
      {players.map((p) => (
        <Button
          key={p.id}
          type="button"
          variant={p.id === selectedId ? 'secondary' : 'ghost'}
          size="sm"
          className="w-full !justify-between text-left"
          aria-current={p.id === selectedId ? 'true' : undefined}
          onClick={() => onSelect(p.id)}
        >
          <span className="truncate">{p.name}</span>
          <span className="flex items-center gap-1 shrink-0" title={`${p.readDone ? 'Read. ' : ''}${p.cards} card${p.cards === 1 ? '' : 's'} on the board`}>
            {p.readDone && <span aria-label="read">✓</span>}
            <Badge variant={p.cards ? 'success' : 'neutral'} size="sm">
              {p.cards}
            </Badge>
          </span>
        </Button>
      ))}
    </nav>
  );
}
