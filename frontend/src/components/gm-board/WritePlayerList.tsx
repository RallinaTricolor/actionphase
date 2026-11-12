import { Badge, Button } from '@/components/ui';
import CharacterAvatar from '@/components/characters/CharacterAvatar';
import { TOOLBAR_LABEL } from './boardToolbarSlot';

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

/**
 * Everyone who gets a result, as a strip of chips in the Write step's toolbar:
 * where their result is, its coverage and possible leaks.
 */
export function WritePlayerList({ players, selectedId, onSelect }: WritePlayerListProps) {
  const ready = players.filter((p) => p.status === 'ready').length;
  return (
    <nav aria-label="Results" className="flex flex-wrap items-center gap-1.5" data-testid="write-player-list">
      <span className={`mr-1 ${TOOLBAR_LABEL}`}>
        {ready}/{players.length} ready
      </span>
      {players.map((p) => (
        <Button
          key={p.id}
          type="button"
          variant={p.id === selectedId ? 'primary' : 'outline'}
          size="sm"
          className="max-w-[15rem] gap-1.5 !py-1 text-left"
          aria-current={p.id === selectedId ? 'true' : undefined}
          onClick={() => onSelect(p.id)}
        >
          <CharacterAvatar avatarUrl={p.avatarUrl} characterName={p.name} size="xs" />
          <span className="min-w-0 leading-tight">
            <span className="block truncate">{p.name}</span>
            <span className={`block text-xs font-normal ${p.id === selectedId ? '' : p.status === 'ready' ? 'text-semantic-success' : 'text-content-tertiary'}`}>
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
