import type { Character } from '@/types/characters';
import type { GameParticipant } from '@/types/games';

/**
 * Restricted Common Room posts are restricted to users, not characters, but
 * the GM thinks in characters, so every place that names a viewer leads with
 * their player characters and falls back to the username.
 */
export interface PickablePlayer {
  userId: number;
  username: string;
  characterNames: string[];
}

function playerCharacterNames(userId: number, characters: readonly Character[]): string[] {
  return characters
    .filter((c) => c.user_id === userId && c.character_type === 'player_character')
    .map((c) => c.name);
}

/** How a viewer is named: their player characters, or their username if they have none. */
export function playerLabel(player: PickablePlayer): string {
  return player.characterNames.length > 0 ? player.characterNames.join(', ') : player.username;
}

/**
 * The players a post can be restricted to. The backend accepts active players
 * only (co-GMs and audience already see every restricted post).
 */
export function listPickablePlayers(
  participants: readonly GameParticipant[],
  characters: readonly Character[]
): PickablePlayer[] {
  return participants
    .filter((p) => p.role === 'player' && p.status === 'active')
    .map((p) => ({
      userId: p.user_id,
      username: p.username,
      characterNames: playerCharacterNames(p.user_id, characters),
    }))
    .sort((a, b) => playerLabel(a).localeCompare(playerLabel(b)));
}

/**
 * Names the users on a post's allowlist. A listed user who has since left the
 * game keeps access, so they are still named, from the participant list if it
 * has them.
 */
export function describeViewers(
  userIds: readonly number[],
  participants: readonly GameParticipant[],
  characters: readonly Character[]
): string[] {
  return userIds.map((userId) => {
    const participant = participants.find((p) => p.user_id === userId);
    return playerLabel({
      userId,
      username: participant?.username ?? 'Unknown player',
      characterNames: playerCharacterNames(userId, characters),
    });
  });
}
