import { createElement, type ReactNode } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { act, renderHook, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse, type RequestHandler } from 'msw';
import { server } from '@/mocks/server';
import { renderWithProviders } from '@/test-utils';
import { Button } from '@/components/ui';
import { useGameContext } from '@/contexts/GameContext';
import type { CharacterSheetConfig } from '@/types/characters';
import type { Scoreboard } from '@/types/scoreboard';
import { usePublishActionResult, usePublishAllPhaseResults } from './useActionResults';
import { useDeleteCharacterAvatar, useUploadCharacterAvatar } from './useCharacterAvatar';
import { useRenameCharacter } from './useCharacters';
import { useUpdateCharacterSheet } from './useCharacterSheetLayout';
import { usePhaseActivation } from './usePhaseActivation';
import { useReassignCharacter, useRemovePlayer } from './usePlayerManagement';
import { scoreboardEntryNamesQueryKey, scoreboardQueryKey, useScoreboard } from './useScoreboard';

const GAME_ID = 7;
const OTHER_GAME_ID = 8;
const PHASE_ID = 3;
const RESULT_ID = 5;
const CHARACTER_ID = 11;
const USER_ID = 9;

const GAME_URL = `/api/v1/games/${GAME_ID}`;
const CHARACTER_URL = `/api/v1/characters/${CHARACTER_ID}`;

const board: Scoreboard = { columns: [], sort_description: [], full_view: false, rows: [] };

let client: QueryClient;

function wrapper({ children }: { children: ReactNode }) {
  return createElement(QueryClientProvider, { client }, children);
}

interface Mutation<Variables> {
  mutateAsync: (variables: Variables) => Promise<unknown>;
}

async function runMutation<Variables>(useMutationHook: () => Mutation<Variables>, variables: Variables) {
  const { result } = renderHook(useMutationHook, { wrapper });
  await act(async () => {
    await result.current.mutateAsync(variables);
  });
}

const isInvalidated = (queryKey: readonly unknown[]) => client.getQueryState(queryKey)?.isInvalidated;

const expectGameRefreshed = (gameId: number, refreshed: boolean) => {
  expect(isInvalidated(scoreboardQueryKey(gameId))).toBe(refreshed);
  expect(isInvalidated(scoreboardEntryNamesQueryKey(gameId))).toBe(refreshed);
};

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  for (const gameId of [GAME_ID, OTHER_GAME_ID]) {
    client.setQueryData(scoreboardQueryKey(gameId), board);
    client.setQueryData(scoreboardEntryNamesQueryKey(gameId), []);
  }
});

const ok = () => HttpResponse.json({});

interface Change {
  name: string;
  handler: RequestHandler;
  run: () => Promise<void>;
}

const changesToOneGame: Change[] = [
  {
    name: 'publishing a result, which applies its sheet updates',
    handler: http.post(`${GAME_URL}/results/${RESULT_ID}/publish`, ok),
    run: () => runMutation(() => usePublishActionResult(GAME_ID), RESULT_ID),
  },
  {
    name: "publishing a phase's results",
    handler: http.post(`${GAME_URL}/phases/${PHASE_ID}/results/publish`, ok),
    run: () => runMutation(() => usePublishAllPhaseResults(GAME_ID, PHASE_ID), undefined),
  },
  {
    name: 'publishing results before activating a phase',
    handler: http.post(`${GAME_URL}/phases/${PHASE_ID}/results/publish`, ok),
    run: () => runMutation(() => usePhaseActivation(GAME_ID, PHASE_ID, false).publishAllMutation, undefined),
  },
  {
    name: 'removing a player, which deactivates their characters',
    handler: http.delete(`${GAME_URL}/participants/${USER_ID}`, ok),
    run: () => runMutation(() => useRemovePlayer(GAME_ID), USER_ID),
  },
  {
    name: 'reassigning a character',
    handler: http.put(`${CHARACTER_URL}/reassign`, () => HttpResponse.json({ id: CHARACTER_ID, game_id: GAME_ID })),
    run: () => runMutation(useReassignCharacter, { characterId: CHARACTER_ID, newOwnerUserId: USER_ID }),
  },
  {
    name: 'renaming a character in a known game',
    handler: http.put(`${CHARACTER_URL}/rename`, ok),
    run: () => runMutation(useRenameCharacter, { characterId: CHARACTER_ID, name: 'Wren', gameId: GAME_ID }),
  },
  {
    name: 'saving the sheet layout',
    handler: http.put(`${GAME_URL}/character-sheet`, ok),
    run: () => runMutation(() => useUpdateCharacterSheet(GAME_ID), {} as CharacterSheetConfig),
  },
];

/** These callers know only the character, so every game's board is refreshed. */
const changesToAnUnknownGame: Change[] = [
  {
    name: 'renaming a character from its sheet',
    handler: http.put(`${CHARACTER_URL}/rename`, ok),
    run: () => runMutation(useRenameCharacter, { characterId: CHARACTER_ID, name: 'Wren' }),
  },
  {
    name: 'uploading an avatar',
    handler: http.post(`${CHARACTER_URL}/avatar`, () => HttpResponse.json({ avatar_url: '/a.png' })),
    run: () => runMutation(useUploadCharacterAvatar, {
      characterId: CHARACTER_ID,
      file: new File(['image'], 'a.png', { type: 'image/png' }),
    }),
  },
  {
    name: 'removing an avatar',
    handler: http.delete(`${CHARACTER_URL}/avatar`, ok),
    run: () => runMutation(useDeleteCharacterAvatar, CHARACTER_ID),
  },
];

describe('keeping the scoreboard current', () => {
  beforeEach(() => {
    // usePhaseActivation reads the phase's results for its blank-draft warning.
    server.use(http.get(`${GAME_URL}/results`, () => HttpResponse.json([])));
  });

  it.each(changesToOneGame)('refreshes only that game after $name', async ({ handler, run }) => {
    server.use(handler);
    await run();
    expectGameRefreshed(GAME_ID, true);
    expectGameRefreshed(OTHER_GAME_ID, false);
  });

  it.each(changesToAnUnknownGame)('refreshes every board after $name', async ({ handler, run }) => {
    server.use(handler);
    await run();
    expectGameRefreshed(GAME_ID, true);
    expectGameRefreshed(OTHER_GAME_ID, true);
  });

  it('keeps the board when a publish is refused, because nothing changed', async () => {
    server.use(http.post(`${GAME_URL}/results/${RESULT_ID}/publish`, () => new HttpResponse(null, { status: 409 })));
    await expect(runMutation(() => usePublishActionResult(GAME_ID), RESULT_ID)).rejects.toThrow();
    expectGameRefreshed(GAME_ID, false);
  });

  it('refetches an open board when the game data is refreshed, as after a state change', async () => {
    let boardRequests = 0;
    server.use(
      http.get(GAME_URL + '/scoreboard', () => {
        boardRequests += 1;
        return HttpResponse.json(board);
      }),
      http.get(`${GAME_URL}/details`, () => HttpResponse.json({ id: GAME_ID, state: 'in_progress' })),
      http.get(`${GAME_URL}/participants`, () => HttpResponse.json([])),
      http.get(`${GAME_URL}/characters`, () => HttpResponse.json([])),
      http.get(`${GAME_URL}/characters/controllable`, () => HttpResponse.json([])),
    );

    function OpenBoard() {
      useScoreboard(GAME_ID);
      const { refetchGameData } = useGameContext();
      return <Button onClick={() => void refetchGameData()}>Refresh game</Button>;
    }

    renderWithProviders(<OpenBoard />, { gameId: GAME_ID });
    await waitFor(() => expect(boardRequests).toBe(1));

    await userEvent.click(await screen.findByRole('button', { name: 'Refresh game' }));
    await waitFor(() => expect(boardRequests).toBe(2));
  });
});
