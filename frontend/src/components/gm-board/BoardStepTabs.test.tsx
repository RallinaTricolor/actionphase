import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';
import { renderWithProviders } from '@/test-utils/render';
import { makeActionResult, makeActionWithDetails, makeBoard, makeCard, makeCharacter, makeGameWithDetails } from '@/test-utils/factories';
import { BoardStepTabs } from './BoardStepTabs';

const GAME_ID = 7;
const PHASE_ID = 70;

beforeEach(() => {
  server.use(
    http.get(`/api/v1/games/${GAME_ID}/details`, () => HttpResponse.json(makeGameWithDetails({ id: GAME_ID, gm_user_id: 1, state: 'in_progress' }))),
    http.get(`/api/v1/games/${GAME_ID}/characters`, () =>
      HttpResponse.json([
        makeCharacter({ id: 1, game_id: GAME_ID, name: 'Harrison Vale', user_id: 11 }),
        makeCharacter({ id: 2, game_id: GAME_ID, name: 'Mara', user_id: 12 }),
        // An NPC a player runs gets a result; one nobody runs doesn't.
        makeCharacter({ id: 3, game_id: GAME_ID, name: 'Tom Brewer', character_type: 'npc', user_id: undefined, assigned_user_id: 13 }),
        makeCharacter({ id: 4, game_id: GAME_ID, name: 'The Watch', character_type: 'npc', user_id: undefined }),
      ]),
    ),
    http.get(`/api/v1/games/${GAME_ID}/actions`, () =>
      HttpResponse.json([
        makeActionWithDetails({ id: 41, game_id: GAME_ID, phase_id: PHASE_ID, character_id: 1, content: 'I wait.' }),
        makeActionWithDetails({ id: 42, game_id: GAME_ID, phase_id: PHASE_ID, character_id: 2, content: 'I go.' }),
        makeActionWithDetails({ id: 43, game_id: GAME_ID, phase_id: 69, character_id: 3, content: 'Last phase.' }),
      ]),
    ),
    http.get(`/api/v1/games/${GAME_ID}/gm-settings`, () => HttpResponse.json({ items: [], cursor: 0, share_gm_board: false })),
    http.get(`/api/v1/games/${GAME_ID}/results`, () => HttpResponse.json([])),
  );
});

const board = makeBoard({
  readDone: { 1: true },
  ready: { 2: true },
  cards: [makeCard({ id: 'a', characterId: 1, outcome: 'happened' }), makeCard({ id: 'b', characterId: 2, chunkId: 'k2' })],
});

describe('BoardStepTabs', () => {
  it('shows each step’s progress: read, left to resolve, and ready over everyone who gets a result', async () => {
    renderWithProviders(<BoardStepTabs gameId={GAME_ID} phaseId={PHASE_ID} board={board} step="read" onStep={() => {}} />, { gameId: GAME_ID });

    await waitFor(() => expect(screen.getByTestId('tab-read')).toHaveTextContent('1/2 read'));
    expect(screen.getByTestId('tab-map')).toHaveTextContent('1 to resolve');
    expect(screen.getByTestId('tab-scenes')).toHaveTextContent(/^Scenes$/);
    await waitFor(() => expect(screen.getByTestId('tab-write')).toHaveTextContent('1/3 ready'));
  });

  it('counts someone who only has a result this phase on Write, as the Write list does', async () => {
    server.use(
      http.get(`/api/v1/games/${GAME_ID}/results`, () =>
        HttpResponse.json([makeActionResult({ id: 9, game_id: GAME_ID, phase_id: PHASE_ID, character_id: 4, content: 'The Watch hears.' })]),
      ),
    );
    renderWithProviders(<BoardStepTabs gameId={GAME_ID} phaseId={PHASE_ID} board={board} step="read" onStep={() => {}} />, { gameId: GAME_ID });
    await waitFor(() => expect(screen.getByTestId('tab-write')).toHaveTextContent('1/4 ready'));
  });

  it('shows plain tabs while the board loads, and switches step on click', async () => {
    const onStep = vi.fn();
    renderWithProviders(<BoardStepTabs gameId={GAME_ID} phaseId={PHASE_ID} board={null} step="read" onStep={onStep} />, { gameId: GAME_ID });
    expect(screen.getByTestId('tab-read')).toHaveTextContent(/^Read$/);
    await userEvent.click(screen.getByTestId('tab-map'));
    expect(screen.getByTestId('tab-map')).toHaveAttribute('href', `/games/${GAME_ID}/phases/${PHASE_ID}/board?step=map`);
  });
});
