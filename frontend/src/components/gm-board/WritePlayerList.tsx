import { Badge, Button } from '@/components/ui';
import CharacterAvatar from '@/components/characters/CharacterAvatar';

export interface WritePlayer {
  id: number;
  name: string;
  avatarUrl?: string | null;
  status: 'ready' | 'published' | 'draft' | 'not started';
  covered: number;
  moments: number;
  leaks: number;
}

interface WritePlayerListProps {
  players: WritePlayer[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}

/** Everyone who gets a result, with where their result is, its coverage and possible leaks. */
export function WritePlayerList({ players, selectedId, onSelect }: WritePlayerListProps) {
  const ready = players.filter((p) => p.status === 'ready').length;
  return (
    <nav aria-label="Results" className="space-y-1" data-testid="write-player-list">
      <p className="px-2 pb-1 text-sm text-content-secondary">
        {ready}/{players.length} ready
      </p>
      {players.map((p) => (
        <Button
          key={p.id}
          type="button"
          variant={p.id === selectedId ? 'secondary' : 'ghost'}
          size="sm"
          className="!flex w-full !justify-start gap-2 text-left"
          aria-current={p.id === selectedId ? 'true' : undefined}
          onClick={() => onSelect(p.id)}
        >
          <CharacterAvatar avatarUrl={p.avatarUrl} characterName={p.name} size="xs" />
          <span className="min-w-0 flex-1">
            <span className="block truncate">{p.name}</span>
            <span className={`block text-xs ${p.status === 'ready' ? 'text-semantic-success' : 'text-content-tertiary'}`}>
              {p.status} · {p.covered}/{p.moments}
            </span>
          </span>
          {p.leaks > 0 && (
            <Badge variant="danger" size="sm" title={`${p.leaks} possible leak${p.leaks === 1 ? '' : 's'}`}>
              {p.leaks}
            </Badge>
          )}
        </Button>
      ))}
    </nav>
  );
}
