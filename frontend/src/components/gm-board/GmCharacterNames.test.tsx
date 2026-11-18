import { describe, it, expect, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';
import { renderWithProviders } from '@/test-utils/render';
import { makeGmItem } from '@/test-utils/factories';
import type { GmItem, SettingsItemChange } from '@/types/gmBoard';
import { GmCharacterNames } from './GmCharacterNames';

const GAME_ID = 7;
const SETTINGS = `/api/v1/games/${GAME_ID}/gm-settings`;
const characters = [
  { id: 1, name: 'Harrison Vale', npc: false },
  { id: 9, name: 'Bo Hale', npc: true },
];

let stored: GmItem[];
let saves: SettingsItemChange[][];

beforeEach(() => {
  stored = [];
  saves = [];
  server.use(
    http.get(SETTINGS, () => HttpResponse.json({ items: stored, cursor: 1, share_gm_board: false })),
    http.post(`${SETTINGS}/changes`, async ({ request }) => {
      const { changes } = (await request.json()) as { changes: SettingsItemChange[] };
      saves.push(changes);
      return HttpResponse.json({
        items: changes.map((c) => makeGmItem({ kind: c.kind, key: c.key, version: c.base_version + 1, seq: 20, doc: c.doc, deleted: !!c.deleted })),
      });
    }),
  );
});

describe('GmCharacterNames', () => {
  it('starts each character on the full name and first word', async () => {
    renderWithProviders(<GmCharacterNames gameId={GAME_ID} characters={characters} />);
    expect(await screen.findByLabelText('Harrison Vale')).toHaveValue('Harrison Vale, Harrison');
    expect(screen.getByLabelText('Bo Hale (NPC)')).toHaveValue('Bo Hale');
    expect(screen.queryByRole('button', { name: 'Use default' })).not.toBeInTheDocument();
  });

  it('saves the GM’s list, and goes back to the default', async () => {
    renderWithProviders(<GmCharacterNames gameId={GAME_ID} characters={characters} />);
    const box = await screen.findByLabelText('Harrison Vale');
    await userEvent.clear(box);
    await userEvent.type(box, 'Harrison, Vale, the Captain');
    await waitFor(() => expect(saves.length).toBeGreaterThan(0), { timeout: 3000 });
    await waitFor(() =>
      expect(saves.flat().at(-1)).toMatchObject({ kind: 'names', key: '1', doc: { names: ['Harrison', 'Vale', 'the Captain'] } }),
    );

    await userEvent.click(screen.getByRole('button', { name: 'Use default' }));
    expect(screen.getByLabelText('Harrison Vale')).toHaveValue('Harrison Vale, Harrison');
  });

  it('keeps an empty list: that character isn’t matched', async () => {
    stored = [makeGmItem({ kind: 'names', key: '9', doc: { names: [] } })];
    renderWithProviders(<GmCharacterNames gameId={GAME_ID} characters={characters} />);
    expect(await screen.findByLabelText('Bo Hale (NPC)')).toHaveValue('');
    expect(screen.getByLabelText('Bo Hale (NPC)')).toHaveAttribute('placeholder', 'Not matched');
  });
});
