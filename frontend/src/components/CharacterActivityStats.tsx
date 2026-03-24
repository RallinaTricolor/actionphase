import { MetadataSeparator } from './ui';
import type { CharacterActivityStats as CharacterActivityStatsType } from '../types/characters';

interface CharacterActivityStatsProps {
  stats: CharacterActivityStatsType;
  className?: string;
}

export function CharacterActivityStats({ stats, className = '' }: CharacterActivityStatsProps) {
  return (
    <div className={`flex items-center gap-2 text-sm text-content-secondary ${className}`} data-testid="character-stats">
      <span>Messages:</span>
      <span data-testid="public-message-count">{stats.public_messages} public</span>
      {stats.private_messages !== undefined && (
        <>
          <MetadataSeparator />
          <span data-testid="private-message-count">{stats.private_messages} private</span>
        </>
      )}
    </div>
  );
}
