import { describe, it, expect, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';
import { renderWithProviders } from '@/test-utils/render';
import { makeCharacter, makeGamePhase, makeGameWithDetails, makeGmItem } from '@/test-utils/factories';
import type { BoardItemChange, GmItem, SettingsItemChange } from '@/types/gmBoard';
import { GmBoardSetupPage } from '@/pages/GmBoardSetupPage';

// Hand-written test data; never player content.
const GAME_ID = 9;
const PHASE_ID = 90;
let settings: Map<string, GmItem>;
let settingsSaves: SettingsItemChange[];
let boardSaves: BoardItemChange[];
let seq: number;

const apply = <C extends { kind: string; key: string; base_version: number; doc?: unknown; deleted?: boolean }>(store: Map<string, GmItem>, saves: C[], changes: C[]) =>
  changes.map((c) => {
    saves.push(c);
    const saved = makeGmItem({ kind: c.kind, key: c.key, version: c.base_version + 1, seq: ++seq, doc: c.doc as Record<string, unknown>, deleted: !!c.deleted });
    store.set(`${c.kind}/${c.key}`, saved);
    return saved;
  });

beforeEach(() => {
  seq = 1;
  settingsSaves = [];
  boardSaves = [];
  settings = new Map();
  const board = new Map<string, GmItem>();
  server.use(
    http.get(`/api/v1/games/${GAME_ID}/details`, () => HttpResponse.json(makeGameWithDetails({ id: GAME_ID, title: 'Starfall', gm_user_id: 1, state: 'in_progress' }))),
    http.get(`/api/v1/games/${GAME_ID}/characters`, () => HttpResponse.json([makeCharacter({ id: 1, game_id: GAME_ID, name: 'Harrison Vale', user_id: 11 })])),
    http.get(`/api/v1/games/${GAME_ID}/characters/data`, () =>
      HttpResponse.json({ 1: [{ id: 1, character_id: 1, module_type: 'numbers', field_name: 'numbers', field_value: JSON.stringify([{ id: 'n', name: 'Coin', amount: { value: 4 } }]), field_type: 'json' }] }),
    ),
    http.get(`/api/v1/games/${GAME_ID}/phases`, () => HttpResponse.json([makeGamePhase({ id: PHASE_ID, game_id: GAME_ID, phase_type: 'action', title: 'Day 2' })])),
    http.get(`/api/v1/games/${GAME_ID}/results`, () => HttpResponse.json([])),
    http.get(`/api/v1/games/${GAME_ID}/gm-settings`, () => HttpResponse.json({ items: [...settings.values()].filter((i) => !i.deleted), cursor: seq, share_gm_board: false })),
    http.post(`/api/v1/games/${GAME_ID}/gm-settings/changes`, async ({ request }) => {
      const { changes } = (await request.json()) as { changes: SettingsItemChange[] };
      return HttpResponse.json({ items: apply(settings, settingsSaves, changes) });
    }),
    http.get(`/api/v1/games/${GAME_ID}/phases/${PHASE_ID}/gm-board`, () => HttpResponse.json({ items: [...board.values()].filter((i) => !i.deleted), cursor: seq })),
    http.post(`/api/v1/games/${GAME_ID}/phases/${PHASE_ID}/gm-board/changes`, async ({ request }) => {
      const { changes } = (await request.json()) as { changes: BoardItemChange[] };
      return HttpResponse.json({ items: apply(board, boardSaves, changes) });
    }),
  );
});

const renderPage = () => renderWithProviders(<GmBoardSetupPage />, { gameId: GAME_ID, initialRoute: `/games/${GAME_ID}/board-setup` });
const settingsSaved = (match: (c: SettingsItemChange) => boolean) => waitFor(() => expect(settingsSaves.some(match)).toBe(true), { timeout: 3000 });
const boardSaved = (match: (c: BoardItemChange) => boolean) => waitFor(() => expect(boardSaves.some(match), JSON.stringify(boardSaves) + JSON.stringify(settingsSaves)).toBe(true), { timeout: 3000 });

describe('Game setup: reward lists', () => {
  it('makes an every-phase reward, gives it in a phase, and moves it to that phase’s list', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByTestId('new-game-reward'));
    const editor = await screen.findByTestId('reward-item-editor');
    await user.type(within(editor).getByTestId('item-name'), 'Survivor');
    await settingsSaved((c) => c.kind === 'reward' && (c.doc as { name?: string })?.name === 'Survivor');

    await user.click(within(editor).getByRole('button', { name: 'Harrison Vale' }));
    await boardSaved((c) => c.kind === 'rewards' && c.key === '1' && (c.doc as { lines: { itemId: string }[] }).lines.length === 1);

    await user.click(within(editor).getByLabelText('Day 2 only'));
    await boardSaved((c) => c.kind === 'reward' && (c.doc as { name?: string })?.name === 'Survivor');
    await settingsSaved((c) => c.kind === 'reward' && !!c.deleted);
    // Same id in its new list, so the copy given keeps knowing where it came from.
    const moved = boardSaves.find((c) => c.kind === 'reward')!;
    expect(settingsSaves.find((c) => c.kind === 'reward' && c.deleted)?.key).toBe(moved.key);
  });
});

describe('Game setup: reward block', () => {
  it('starts from a simple template, previews it, and lists problems as you type', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Start from a simple template' }));
    await settingsSaved((c) => c.kind === 'template' && String((c.doc as { text: string }).text).includes('{{lines result}}'));
    await settingsSaved((c) => c.kind === 'groups' && (c.doc as { groups: unknown[] }).groups.length === 3);
    expect(await screen.findByTestId('reward-preview')).toHaveTextContent('# Rewards');

    const template = screen.getByTestId('reward-template');
    await user.clear(template);
    await user.type(template, 'Coin {{{{value Numbers/Coin}} {{{{if objectivs}}x{{{{end}}');
    const problems = await screen.findByTestId('reward-template-problems');
    expect(problems).toHaveTextContent('Did you mean {{if objectives}}?');
    expect(screen.getByTestId('reward-preview')).toHaveTextContent('Coin 4');
  });

  it('saves sections and scales as typed', async () => {
    const user = userEvent.setup();
    renderPage();
    const scales = await screen.findByTestId('reward-scales');
    await user.type(scales, 'Numbers/Coin: 0 Broke, 5 Flush');
    await settingsSaved((c) => c.kind === 'scales' && JSON.stringify((c.doc as { scales: unknown }).scales) === JSON.stringify([{ name: 'Numbers/Coin', steps: [{ min: 0, label: 'Broke' }, { min: 5, label: 'Flush' }] }]));
    await user.type(screen.getByTestId('reward-groups'), 'bonus: Bonus objectives');
    await settingsSaved((c) => c.kind === 'groups' && JSON.stringify((c.doc as { groups: unknown }).groups) === JSON.stringify([{ key: 'bonus', label: 'Bonus objectives' }]));
  });
});
