import { describe, it, expect } from 'vitest';
import { describeViewers, listPickablePlayers, playerLabel } from './postViewers';
import { makeCharacter } from '@/test-utils/factories';
import type { GameParticipant } from '@/types/games';

function participant(overrides: Partial<GameParticipant>): GameParticipant {
  return {
    id: 1,
    game_id: 1,
    user_id: 1,
    username: 'user',
    role: 'player',
    status: 'active',
    avatar_url: null,
    is_former_player: false,
    joined_at: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

const participants: GameParticipant[] = [
  participant({ id: 1, user_id: 10, username: 'zed' }),
  participant({ id: 2, user_id: 11, username: 'amy' }),
  participant({ id: 3, user_id: 12, username: 'cog', role: 'co_gm' }),
  participant({ id: 4, user_id: 13, username: 'aud', role: 'audience' }),
  participant({ id: 5, user_id: 14, username: 'gone', status: 'removed' }),
  participant({ id: 6, user_id: 15, username: 'idle', status: 'inactive' }),
];

const characters = [
  makeCharacter({ id: 1, user_id: 10, name: 'Brynn', character_type: 'player_character' }),
  makeCharacter({ id: 2, user_id: 10, name: 'Aldo', character_type: 'player_character' }),
  // An NPC the player happens to own doesn't name them.
  makeCharacter({ id: 3, user_id: 11, name: 'Shopkeeper', character_type: 'npc' }),
  makeCharacter({ id: 4, user_id: 14, name: 'Old Hero', character_type: 'player_character' }),
];

describe('listPickablePlayers', () => {
  it('offers only active players, the roles the backend accepts', () => {
    const ids = listPickablePlayers(participants, characters).map((p) => p.userId);
    expect(ids.sort()).toEqual([10, 11]);
  });

  it('labels players by their player characters, falling back to the username, sorted by label', () => {
    const players = listPickablePlayers(participants, characters);
    expect(players.map(playerLabel)).toEqual(['amy', 'Brynn, Aldo']);
  });
});

describe('describeViewers', () => {
  it('names viewers who have left the game too', () => {
    expect(describeViewers([10, 14], participants, characters)).toEqual(['Brynn, Aldo', 'Old Hero']);
  });

  it('falls back when the user is unknown', () => {
    expect(describeViewers([99], participants, characters)).toEqual(['Unknown player']);
  });
});
