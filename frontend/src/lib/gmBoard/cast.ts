/** The characters the board works with: the game's active, approved characters, NPCs marked. */

export interface CastMember {
  id: number;
  name: string;
  npc: boolean;
}

interface CharacterLike {
  id: number;
  name: string;
  character_type?: string;
  is_active: boolean;
  status: string;
}

/** Active, approved characters, players first, then NPCs, each in the order given. */
export function boardCast(characters: CharacterLike[]): CastMember[] {
  const live = characters
    .filter((c) => c.is_active && c.status === 'approved')
    .map((c) => ({ id: c.id, name: c.name, npc: c.character_type === 'npc' }));
  return [...live.filter((c) => !c.npc), ...live.filter((c) => c.npc)];
}
