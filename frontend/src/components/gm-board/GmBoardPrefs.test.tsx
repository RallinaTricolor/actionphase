import { describe, it, expect, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';
import { renderWithProviders } from '@/test-utils/render';
import type { SettingsItemChange } from '@/types/gmBoard';
import { GmBoardPrefs } from './GmBoardPrefs';

const GAME_ID = 7;
let saves: SettingsItemChange[];

beforeEach(() => {
  saves = [];
  server.use(
    http.get(`/api/v1/games/${GAME_ID}/gm-settings`, () => HttpResponse.json({ items: [], cursor: 0, share_gm_board: false })),
    http.post(`/api/v1/games/${GAME_ID}/gm-settings/changes`, async ({ request }) => {
      const { changes } = (await request.json()) as { changes: SettingsItemChange[] };
      saves.push(...changes);
      return HttpResponse.json({ items: changes.map((c, i) => ({ ...c, game_id: GAME_ID, version: 1, seq: i + 1, deleted: false, updated_at: '', updated_by: 1 })) });
    }),
  );
});

describe('GmBoardPrefs', () => {
  it('is on by default, and turning it off saves the game’s prefs', async () => {
    renderWithProviders(<GmBoardPrefs gameId={GAME_ID} />, { gameId: GAME_ID });
    const toggle = await screen.findByRole('switch', { name: /Moments read as “you”/ });
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    await userEvent.click(toggle);
    await waitFor(() => expect(saves).toEqual([expect.objectContaining({ kind: 'prefs', key: 'prefs', doc: { secondPerson: false } })]), { timeout: 3000 });
  });
});
