/** The characters the board works with: the game's active, approved characters, NPCs marked. */

import type { CanRead } from './moments';

export interface CastMember {
  id: number;
  name: string;
  npc: boolean;
  avatarUrl?: string | null;
  /**
   * Gets results: someone plays them (their own player, or the player an NPC
   * is assigned to). Only they can read a scene's moments.
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
    .map((c) => ({
      id: c.id,
      name: c.name,
      npc: c.character_type === 'npc',
      avatarUrl: c.avatar_url,
      // A result goes to a user, as in the standalone result composer.
      reads: (c.user_id ?? c.assigned_user_id) !== undefined,
      userId: c.user_id ?? c.assigned_user_id,
    }));
  return [...live.filter((c) => !c.npc), ...live.filter((c) => c.npc)];
}

/** Who can read moments: cast members someone plays. */
export function canReadRule(cast: CastMember[]): CanRead {
  const readers = new Set(cast.filter((c) => c.reads).map((c) => c.id));
  return (id) => readers.has(id);
}
