import { describe, expect, it } from 'vitest';
import { canViewScoreboard } from './scoreboardVisibility';

const viewers = {
  gm: { isGM: true, isAudience: false },
  audience: { isGM: false, isAudience: true },
  player: { isGM: false, isAudience: false },
};

describe('canViewScoreboard', () => {
  it.each([
    ['in_progress', 'gm', 'staff', true],
    ['in_progress', 'audience', 'staff', true],
    ['in_progress', 'player', 'staff', false],
    ['in_progress', 'gm', 'public', true],
    ['in_progress', 'audience', 'public', true],
    ['in_progress', 'player', 'public', true],
    ['paused', 'player', 'public', true],
    ['paused', 'player', 'staff', false],
    ['epilogue', 'player', 'staff', true],
    ['completed', 'player', 'staff', true],
  ] as const)('%s, %s, %s board: %s', (gameState, viewer, visibility, expected) => {
    expect(canViewScoreboard({ gameState, enabled: true, visibility, ...viewers[viewer] })).toBe(expected);
  });

  it('treats an absent visibility as GM and audience only', () => {
    const input = { gameState: 'in_progress', enabled: true, visibility: undefined };
    expect(canViewScoreboard({ ...input, ...viewers.player })).toBe(false);
    expect(canViewScoreboard({ ...input, ...viewers.gm })).toBe(true);
  });

  it.each(Object.keys(viewers) as (keyof typeof viewers)[])('offers %s nothing when the setting is off, even in an archive', (viewer) => {
    expect(canViewScoreboard({ gameState: 'completed', enabled: false, visibility: 'public', ...viewers[viewer] })).toBe(false);
  });

  it.each(['setup', 'recruitment', 'character_creation', 'cancelled', undefined])('has no tab in state %s', (gameState) => {
    expect(canViewScoreboard({ gameState, enabled: true, visibility: 'public', ...viewers.gm })).toBe(false);
  });
});
