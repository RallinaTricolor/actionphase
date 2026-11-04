import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { focusManager } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';
import { renderWithProviders } from '@/test-utils/render';
import {
  makeActionResult,
  makeActionWithDetails,
  makeCharacter,
  makeGameParticipant,
  makeGamePhase,
  makeGameWithDetails,
  makeGmItem,
} from '@/test-utils/factories';
import type { GmItem } from '@/types/gmBoard';
import { GmBoard } from './GmBoard';

// Hand-written test data; never player content.
const GAME_ID = 7;
const PHASE_ID = 70;
const phase = makeGamePhase({ id: PHASE_ID, game_id: GAME_ID, phase_type: 'action', title: 'Day 2' });
const BOARD = `/api/v1/games/${GAME_ID}/phases/${PHASE_ID}/gm-board`;
const SETTINGS = `/api/v1/games/${GAME_ID}/gm-settings`;

const item = (kind: string, key: string, doc: Record<string, unknown>) => makeGmItem({ kind, key, doc });
const cardDoc = (doc: Record<string, unknown>) => ({
  quote: '', summary: '', note: '', locationId: 'mill', chunkId: 'k2', outcome: 'happened', causedBy: [], isIF: false, cond: '', branchOf: null, src: [], gm: false, ...doc,
});

const BOARD_ITEMS: GmItem[] = [
  item('chunk', 'k1', { name: 'Pre-Scenario', position: 1 }),
  item('chunk', 'k2', { name: 'Slot 1', position: 2 }),
  item('card', 'c-h', cardDoc({ characterId: 1, quote: 'I wait by the wheel.', summary: 'Waits by the wheel', note: 'The miller sees him', src: [0] })),
  item('card', 'c-m', cardDoc({ characterId: 2, summary: 'Follows him', outcome: 'pending' })),
  item('card', 'c-if', cardDoc({ characterId: 2, summary: 'Runs for the door', isIF: true, cond: 'the bell rings', chunkId: null, outcome: 'pending' })),
  item('stance', '2|1', { value: 'ally', note: 'Owes him a favour' }),
  item('cluster', 'cl1', { name: 'Mill crew', characterIds: [1, 2] }),
  item('progress', '1', { readDone: true, ready: true }),
  item('scene', 's1', {
    title: 'At the mill', locationId: 'mill', chunkId: 'k2', conflict: true, participants: [1, 2],
    moments: [
      { id: 'm1', text: 'Harrison waits by the wheel.', readers: [1, 2], ownText: { 2: 'You see Harrison by the wheel.' } },
      { id: 'm2', text: 'The miller is the informant.', readers: [], ownText: {} },
    ],
    effects: [{ characterId: 2, state: 'injured' }],
  }),
  item('rewards', '1', { lines: [{ id: 'rl1', group: 'job', text: 'Kept watch all night', ops: [], choose: false }], texts: {} }),
  item('notes', 'notes', { text: 'Remember the bell.' }),
];
const SETTINGS_ITEMS: GmItem[] = [
  item('codex', 'mill', { type: 'Location', name: 'the Old Mill', notes: 'Creaks.' }),
  item('codex', 'orrin', { type: 'Person', name: 'Orrin', secret: true, knownBy: [2] }),
  item('groups', 'groups', { groups: [{ key: 'job', label: 'Job result' }] }),
  item('template', 'template', { text: '{{lines job}}' }),
];

// GM-only reads a viewer's board must never make (they'd be refused).
const GM_ONLY = [
  `/api/v1/games/${GAME_ID}/actions`,
  `/api/v1/games/${GAME_ID}/phases/${PHASE_ID}/draft-character-updates`,
  `/api/v1/games/${GAME_ID}/phases/${PHASE_ID}/results/unpublished-count`,
];

let shared: boolean;
let writes: string[];
let gmOnlyCalls: string[];
const onRequest = ({ request }: { request: Request }) => {
  const path = new URL(request.url).pathname;
  if (request.method !== 'GET') writes.push(`${request.method} ${path}`);
  if (GM_ONLY.includes(path) || /\/character-updates(\/count)?$/.test(path)) gmOnlyCalls.push(path);
};

beforeEach(() => {
  shared = true;
  writes = [];
  gmOnlyCalls = [];
  server.events.on('request:start', onRequest);
  server.use(
    // The mocked current user is user 1: an audience member, not the GM.
    http.get(`/api/v1/games/${GAME_ID}/details`, () =>
      HttpResponse.json(makeGameWithDetails({ id: GAME_ID, gm_user_id: 99, state: 'in_progress', share_gm_board: true })),
    ),
    http.get(`/api/v1/games/${GAME_ID}/participants`, () =>
      HttpResponse.json([makeGameParticipant({ game_id: GAME_ID, user_id: 1, role: 'audience' })]),
    ),
    http.get(`/api/v1/games/${GAME_ID}/characters`, () =>
      HttpResponse.json([
        makeCharacter({ id: 1, game_id: GAME_ID, name: 'Harrison Vale', user_id: 11 }),
        makeCharacter({ id: 2, game_id: GAME_ID, name: 'Mara', user_id: 12 }),
      ]),
    ),
    http.get(`/api/v1/games/${GAME_ID}/action-submissions/all`, () =>
      HttpResponse.json({
        action_submissions: [
          makeActionWithDetails({ id: 44, game_id: GAME_ID, phase_id: PHASE_ID, character_id: 1, content: 'I wait by the wheel.' }),
          makeActionWithDetails({ id: 45, game_id: GAME_ID, phase_id: PHASE_ID, character_id: 2, content: 'I follow Harrison.' }),
        ],
        total: 2,
      }),
    ),
    http.get(`/api/v1/games/${GAME_ID}/phases`, () => HttpResponse.json([phase])),
    http.get(BOARD, () =>
      shared ? HttpResponse.json({ items: BOARD_ITEMS, cursor: 20 }) : HttpResponse.json({ status: 403, detail: 'not shared' }, { status: 403 }),
    ),
    http.get(SETTINGS, () =>
      shared
        ? HttpResponse.json({ items: SETTINGS_ITEMS, cursor: 20, share_gm_board: true })
        : HttpResponse.json({ status: 403, detail: 'not shared' }, { status: 403 }),
    ),
    http.get(`/api/v1/games/${GAME_ID}/results`, () =>
      HttpResponse.json([
        makeActionResult({ id: 501, game_id: GAME_ID, phase_id: PHASE_ID, character_id: 1, user_id: 11, content: 'The wheel turns all night.', is_published: false }),
      ]),
    ),
  );
});

afterEach(() => {
  server.events.removeListener('request:start', onRequest);
});

const renderViewer = (query: string) =>
  renderWithProviders(<GmBoard gameId={GAME_ID} gameTitle="Starfall" phase={phase} readOnly viewer back={{ to: `/games/${GAME_ID}?tab=history&phase=${PHASE_ID}`, label: 'Back to the history' }} />, {
    gameId: GAME_ID,
    initialRoute: `/games/${GAME_ID}/phases/${PHASE_ID}/board?${query}`,
  });

/** Text boxes that only filter what's shown. */
const FILTERS = new Set(['scene-sheet-search', 'scene-codex-search']);
/** Ticks that only change what's shown. */
const VIEW_TICKS = new Set(['scene-show-misses']);
/** Selects that only change what's shown. */
const VIEW_SELECTS = new Set(['tab-select', 'map-cluster', 'scene-picker']);
/** Labels of buttons that change something. */
const EDIT_LABEL =
  /^(\+|add\b|delete|remove|publish|ready|reopen|dismiss|restore|create|insert|make|split|push|put\b|replace|edit\b|use the list|keep mine|start from|→ moment|triggers here|done reading|resolve|stop resolving|set\b|move\b|cancel part|write\b|give\b)/i;

/** No control on the page would change the board: every field is read-only, and no button edits. */
function expectNoEditControls() {
  const root = document.body;
  for (const el of root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input:not([type=checkbox]):not([type=radio]):not([type=hidden]), textarea')) {
    if (FILTERS.has(el.id)) continue;
    expect(el.readOnly || el.disabled, `text field ${el.id || el.getAttribute('aria-label')} can be edited`).toBe(true);
  }
  for (const el of root.querySelectorAll('select')) {
    if (VIEW_SELECTS.has(el.id)) continue;
    expect(el.disabled, `select ${el.id || el.getAttribute('aria-label')} is enabled`).toBe(true);
  }
  for (const el of root.querySelectorAll<HTMLInputElement>('input[type=checkbox], input[type=radio]')) {
    if (VIEW_TICKS.has(el.id)) continue;
    expect(el.disabled, `${el.id || el.getAttribute('aria-label')} can be ticked`).toBe(true);
  }
  for (const el of root.querySelectorAll<HTMLButtonElement>('[role=switch]')) expect(el.disabled, 'a switch is enabled').toBe(true);
  for (const el of root.querySelectorAll<HTMLButtonElement>('button')) {
    if (el.disabled) continue;
    const name = (el.getAttribute('aria-label') ?? el.textContent ?? '').trim();
    expect(EDIT_LABEL.test(name), `button “${name}” edits`).toBe(false);
  }
  expect(root.querySelectorAll('[draggable="true"]'), 'something can be dragged').toHaveLength(0);
}

describe('the results board, read-only', () => {
  it('Read: the submission, cards and stances, with nothing to edit', async () => {
    renderViewer('who=1');
    expect(await screen.findByTestId('gm-board-step-read')).toBeInTheDocument();
    expect(screen.getByTestId('gm-board-read-only')).toHaveTextContent('Read-only');
    expect(screen.getByText('Shared by the GM. It updates as the GM works.')).toBeInTheDocument();
    expect(screen.queryByTestId('gm-board-save-status')).not.toBeInTheDocument();
    expect(await screen.findByText('I wait by the wheel.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Done reading/ })).not.toBeInTheDocument();
    expectNoEditControls();

    // A card opens beside the submission, to read.
    await userEvent.click(screen.getByRole('button', { name: /Waits by the wheel/ }));
    const panel = await screen.findByTestId('card-panel');
    expect(within(panel).getByLabelText('GM note')).toHaveValue('The miller sees him');
    expect(within(panel).queryByRole('button', { name: 'Delete card' })).not.toBeInTheDocument();
    expectNoEditControls();
    expect(writes).toEqual([]);
    expect(gmOnlyCalls).toEqual([]);
  });

  it('Map: every view and the open card, with nothing to edit or drag', async () => {
    const { router } = renderViewer('step=map');
    expect(await screen.findByTestId('gm-board-step-map')).toBeInTheDocument();
    expect((await screen.findAllByText('Slot 1')).length).toBeGreaterThan(0);
    for (const label of ['+ GM cards…', '+ Time slot', 'Resolve ▸', 'Edit clusters']) {
      expect(screen.queryByRole('button', { name: label })).not.toBeInTheDocument();
    }
    expectNoEditControls();

    await userEvent.click(screen.getAllByRole('button', { name: /Follows him/ })[0]);
    expect(await screen.findByTestId('card-panel')).toBeInTheDocument();
    expectNoEditControls();

    await userEvent.click(screen.getByRole('button', { name: 'By character' }));
    expect(await screen.findByTestId('character-row-1')).toBeInTheDocument();
    expectNoEditControls();

    await userEvent.click(screen.getByRole('button', { name: 'Stances' }));
    expect(router.state.location.search).toContain('view=stances');
    await userEvent.click(await screen.findByRole('button', { name: /Mara.*Harrison/ }));
    expect(await screen.findByLabelText('Note')).toHaveValue('Owes him a favour');
    expect(screen.queryByText(/Set several at once/)).not.toBeInTheDocument();
    expectNoEditControls();
    expect(writes).toEqual([]);
  });

  it('Scenes: the moments as text, own versions and GM notes included, and every reference tab', async () => {
    renderViewer('step=scenes&scene=s1');
    expect(await screen.findByTestId('gm-board-step-scenes')).toBeInTheDocument();
    const header = screen.getByTestId('scene-header');
    expect(within(header).getByRole('heading', { name: 'At the mill' })).toBeInTheDocument();
    expect(within(header).getByText('Conflict')).toBeInTheDocument();
    expect(await screen.findByText('Harrison waits by the wheel.')).toBeInTheDocument();
    expect(screen.getByText('You see Harrison by the wheel.')).toBeInTheDocument();
    expect(screen.getByText('The miller is the informant.')).toBeInTheDocument();
    expect(screen.getByText('GM note: nobody reads it')).toBeInTheDocument();
    expect(screen.getByTestId('effect-0')).toHaveTextContent('Mara: Injured');
    expect(screen.queryByRole('button', { name: '+ Moment' })).not.toBeInTheDocument();
    expectNoEditControls();

    for (const tab of ['Submission', 'Sheet', 'Codex', 'Plans']) {
      await userEvent.click(within(screen.getByTestId('scene-reference')).getByRole('button', { name: tab }));
      expectNoEditControls();
    }
    await userEvent.click(screen.getByRole('button', { name: 'Side by side' }));
    expectNoEditControls();
    expect(writes).toEqual([]);
  });

  it('Write: the brief, the draft result as text, and the rewards, with nothing to publish', async () => {
    const { router } = renderViewer('step=write&who=1');
    expect(await screen.findByTestId('gm-board-step-write')).toBeInTheDocument();
    // The results endpoint shows the audience drafts, so the board does too.
    expect(await screen.findByText('The wheel turns all night.')).toBeInTheDocument();
    expect(screen.getByText('Draft')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Publish all' })).not.toBeInTheDocument();
    expect(screen.queryByTestId('result-draft')).not.toBeInTheDocument();
    expect(screen.getAllByText('Ready').length).toBeGreaterThan(0);
    expect(within(await screen.findByTestId('reward-line-rl1')).getByText('Kept watch all night')).toBeInTheDocument();
    expectNoEditControls();

    await userEvent.click(within(screen.getByTestId('reward-line-rl1')).getByRole('button', { name: 'View' }));
    expect(await screen.findByTestId('reward-line-view')).toHaveTextContent('Kept watch all night');
    expect(screen.queryByText(/This result is published/)).not.toBeInTheDocument();
    expectNoEditControls();
    await userEvent.click(screen.getByRole('button', { name: 'Done' }));

    await userEvent.click(screen.getByRole('button', { name: 'Rewards table' }));
    expect(router.state.location.search).toContain('view=table');
    expectNoEditControls();

    // Long enough for the reward sync to have run if it were going to.
    await new Promise((r) => setTimeout(r, 1200));
    expect(writes).toEqual([]);
    expect(gmOnlyCalls).toEqual([]);
  });

  it('the notes and the codex open to read', async () => {
    renderViewer('who=1');
    expect(await screen.findByTestId('gm-board-step-read')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Notes' }));
    expect(await screen.findByText('Remember the bell.')).toBeInTheDocument();
    expectNoEditControls();
    await userEvent.keyboard('{Escape}');

    await userEvent.click(screen.getByRole('button', { name: 'Codex' }));
    const drawer = await screen.findByRole('dialog');
    await userEvent.click(await within(drawer).findByRole('button', { name: 'View Orrin' }));
    expectNoEditControls();
    expect(writes).toEqual([]);
  });

  it('says the board is no longer shared when the next poll is refused', async () => {
    renderViewer('who=1');
    expect(await screen.findByTestId('gm-board-step-read')).toBeInTheDocument();

    shared = false;
    focusManager.setFocused(false);
    focusManager.setFocused(true);
    const notice = await screen.findByTestId('gm-board-not-shared', {}, { timeout: 4000 });
    expect(notice).toHaveTextContent('This board is no longer shared');
    expect(within(notice).getByRole('link', { name: 'Back to the history' })).toHaveAttribute('href', `/games/${GAME_ID}?tab=history&phase=${PHASE_ID}`);
    expect(screen.queryByTestId('gm-board-step-read')).not.toBeInTheDocument();
    focusManager.setFocused(undefined);
  });

  it('is read-only for the GM of an archived game, without a viewer’s wording', async () => {
    renderWithProviders(<GmBoard gameId={GAME_ID} gameTitle="Starfall" phase={phase} readOnly />, {
      gameId: GAME_ID,
      initialRoute: `/games/${GAME_ID}/phases/${PHASE_ID}/board?step=write&who=1`,
    });
    expect(await screen.findByText('This game is archived, so its boards can no longer be changed.')).toBeInTheDocument();
    expect(await screen.findByText('The wheel turns all night.')).toBeInTheDocument();
    await waitFor(() => expectNoEditControls());
    expect(writes).toEqual([]);
  });
});
