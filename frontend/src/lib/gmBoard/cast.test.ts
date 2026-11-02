import { describe, it, expect } from 'vitest';
import { makeCharacter } from '@/test-utils/factories';
import { boardCast } from './cast';

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
      { id: 2, name: 'Mara', npc: false },
      { id: 5, name: 'Harrison', npc: false },
      { id: 1, name: 'Old Tom', npc: true },
    ]);
  });
});
