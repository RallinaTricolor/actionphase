/** The characters the board works with: the game's active, approved characters, NPCs marked. */

import type { CanRead } from './moments';

export interface CastMember {
  id: number;
  name: string;
  npc: boolean;
  avatarUrl?: string | null;
  /**
   * Gets results: a player character someone plays. NPCs never do, even one
   * assigned to a player. Only they can read a scene's moments.
   */
  reads?: boolean;
  /** Who a result for them goes to: their player, or the player an NPC is assigned to. */
  userId?: number;
}

interface CharacterLike {
  id: number;
  name: string;
  character_type?: string;
  is_active: boolean;
  status: string;
  avatar_url?: string | null;
  user_id?: number;
  assigned_user_id?: number;
}

/** Active, approved characters, players first, then NPCs, each in the order given. */
export function boardCast(characters: CharacterLike[]): CastMember[] {
  const live = characters
    .filter((c) => c.is_active && c.status === 'approved')
    .map((c) => {
      const npc = c.character_type === 'npc';
      const userId = c.user_id ?? c.assigned_user_id;
      // A result goes to a player's own character; NPCs can't receive one.
      return { id: c.id, name: c.name, npc, avatarUrl: c.avatar_url, reads: !npc && userId !== undefined, userId };
    });
  return [...live.filter((c) => !c.npc), ...live.filter((c) => c.npc)];
}

/** Who can read moments: player characters someone plays. */
export function canReadRule(cast: CastMember[]): CanRead {
  const readers = new Set(cast.filter((c) => c.reads).map((c) => c.id));
  return (id) => readers.has(id);
}
