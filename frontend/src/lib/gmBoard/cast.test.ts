import { describe, it, expect } from 'vitest';
import { makeCharacter } from '@/test-utils/factories';
import { boardCast, canReadRule } from './cast';

describe('boardCast', () => {
  it('keeps active, approved characters, players before NPCs', () => {
    const cast = boardCast([
      makeCharacter({ id: 1, name: 'Old Tom', character_type: 'npc' }),
      makeCharacter({ id: 2, name: 'Mara' }),
      makeCharacter({ id: 3, name: 'Retired', is_active: false }),
      makeCharacter({ id: 4, name: 'Pending', status: 'pending' }),
      makeCharacter({ id: 5, name: 'Harrison' }),
    ]);
    expect(cast).toEqual([
      { id: 2, name: 'Mara', npc: false, reads: true },
      { id: 5, name: 'Harrison', npc: false, reads: true },
      { id: 1, name: 'Old Tom', npc: true, reads: true },
    ]);
  });
});

describe('canReadRule', () => {
  it('lets players and NPCs assigned to a player read, not unassigned NPCs', () => {
    const cast = boardCast([
      makeCharacter({ id: 1, name: 'Mara' }),
      makeCharacter({ id: 2, name: 'Old Tom', character_type: 'npc', user_id: undefined, assigned_user_id: 100 }),
      makeCharacter({ id: 3, name: 'The Watch', character_type: 'npc', user_id: undefined }),
    ]);
    const canRead = canReadRule(cast);
    expect([1, 2, 3, 44].map(canRead)).toEqual([true, true, false, false]);
  });
});
