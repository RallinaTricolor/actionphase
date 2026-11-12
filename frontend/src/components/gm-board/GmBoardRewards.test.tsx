import { describe, it, expect, beforeEach } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';
import { renderWithProviders } from '@/test-utils/render';
import { makeActionResult, makeActionWithDetails, makeCharacter, makeGamePhase, makeGameWithDetails, makeGmItem } from '@/test-utils/factories';
import type { BoardItemChange, GmItem } from '@/types/gmBoard';
import type { ActionResult, DraftCharacterUpdate } from '@/types/phases';
import { GmBoard } from './GmBoard';

// Hand-written test data; never player content.
const GAME_ID = 8;
const PHASE_ID = 80;
const phase = makeGamePhase({ id: PHASE_ID, game_id: GAME_ID, phase_type: 'action', title: 'Day 2' });
const BOARD = `/api/v1/games/${GAME_ID}/phases/${PHASE_ID}/gm-board`;
const RESULTS = `/api/v1/games/${GAME_ID}/results`;
const SYNC = `/api/v1/games/${GAME_ID}/phases/${PHASE_ID}/characters/:characterId/reward-sheet-updates`;

let board: Map<string, GmItem>;
let boardSaves: BoardItemChange[];
let seq: number;
let results: ActionResult[];
let drafts: DraftCharacterUpdate[];
let syncs: { characterId: number; body: Record<string, unknown> }[];
let resultPuts: { id: number; content: string }[];

const item = (kind: string, key: string, doc: Record<string, unknown>) => [`${kind}/${key}`, makeGmItem({ kind, key, doc })] as const;
const stamp = (n: number) => `2026-11-03T10:00:${String(n).padStart(2, '0')}.000001Z`;
const partial = { name: 'Partial', group: 'result', text: '**Scenario result:** Partial. 2 coin.', ops: [{ act: 'inc', tab: 'numbers', entry: 'Coin', by: 2 }], choose: false, position: 1 };
const coinSheet = JSON.stringify([{ id: 'n1', name: 'Coin', amount: { value: 1 } }]);
const draftRow = (over: Partial<DraftCharacterUpdate>) =>
  ({ id: 1, action_result_id: 100, character_id: 1, module_type: 'inventory', field_name: 'items', field_value: '[]', field_type: 'json', operation: 'upsert', from_rewards: false, created_at: '', updated_at: '', ...over }) as DraftCharacterUpdate;

beforeEach(() => {
  seq = 10;
  boardSaves = [];
  syncs = [];
  resultPuts = [];
  drafts = [];
  results = [makeActionResult({ id: 100, game_id: GAME_ID, phase_id: PHASE_ID, character_id: 1, user_id: 11, is_published: false, content: 'You wait by the wheel.', updated_at: stamp(1) })];
  board = new Map([item('chunk', 'k1', { name: 'Slot 1', position: 1 })]);
  const settings = new Map([
    item('template', 'template', { text: '# Rewards\n\n{{lines result}}\n\nCoin: {{value Numbers/Coin}}' }),
    item('groups', 'groups', { groups: [{ key: 'result', label: 'Scenario result' }] }),
    item('reward', 'rw-partial', partial),
  ]);
  server.use(
    http.get(`/api/v1/games/${GAME_ID}/details`, () => HttpResponse.json(makeGameWithDetails({ id: GAME_ID, gm_user_id: 1, state: 'in_progress' }))),
    http.get(`/api/v1/games/${GAME_ID}/characters`, () =>
      HttpResponse.json([makeCharacter({ id: 1, game_id: GAME_ID, name: 'Harrison Vale', user_id: 11 }), makeCharacter({ id: 2, game_id: GAME_ID, name: 'Mara', user_id: 12 })]),
    ),
    http.get(`/api/v1/games/${GAME_ID}/characters/data`, () =>
      HttpResponse.json({ 1: [{ id: 1, character_id: 1, module_type: 'numbers', field_name: 'numbers', field_value: coinSheet, field_type: 'json' }], 2: [] }),
    ),
    http.get(`/api/v1/games/${GAME_ID}/actions`, () => HttpResponse.json([])),
    http.get(`/api/v1/games/${GAME_ID}/phases`, () => HttpResponse.json([phase])),
    http.get(BOARD, () => HttpResponse.json({ items: [...board.values()].filter((i) => !i.deleted), cursor: seq })),
    http.post(`${BOARD}/changes`, async ({ request }) => {
      const { changes } = (await request.json()) as { changes: BoardItemChange[] };
      const items = changes.map((c) => {
        boardSaves.push(c);
        const saved = makeGmItem({ kind: c.kind, key: c.key, version: c.base_version + 1, seq: ++seq, doc: c.doc, deleted: !!c.deleted });
        board.set(`${c.kind}/${c.key}`, saved);
        return saved;
      });
      return HttpResponse.json({ items });
    }),
    http.get(`/api/v1/games/${GAME_ID}/gm-settings`, () => HttpResponse.json({ items: [...settings.values()], cursor: seq, share_gm_board: false })),
    http.get(RESULTS, () => HttpResponse.json(results)),
    http.get(`/api/v1/games/${GAME_ID}/phases/${PHASE_ID}/results/unpublished-count`, () => HttpResponse.json({ count: results.filter((r) => !r.is_published).length })),
    http.put(`${RESULTS}/:id`, async ({ request, params }) => {
      const body = (await request.json()) as { content: string };
      const r = results.find((x) => x.id === Number(params.id))!;
      Object.assign(r, { content: body.content, updated_at: stamp(++seq % 60) });
      resultPuts.push({ id: r.id, content: body.content });
      return HttpResponse.json(r);
    }),
    http.get(`/api/v1/games/${GAME_ID}/phases/${PHASE_ID}/draft-character-updates`, () => HttpResponse.json(drafts)),
    http.put(SYNC, async ({ request, params }) => {
      const body = (await request.json()) as { result_id?: number; updates: { module_type: string; field_name: string; field_value: string }[]; replace_hand_made?: boolean };
      const characterId = Number(params.characterId);
      syncs.push({ characterId, body });
      drafts = drafts.filter((d) => d.character_id !== characterId || (!d.from_rewards && !body.replace_hand_made));
      body.updates.forEach((u, i) => drafts.push(draftRow({ id: 500 + i, action_result_id: body.result_id, character_id: characterId, ...u, from_rewards: true })));
      return HttpResponse.json(drafts.filter((d) => d.character_id === characterId));
    }),
    http.get(`${RESULTS}/:id/character-updates/count`, ({ params }) => HttpResponse.json({ count: drafts.filter((d) => d.action_result_id === Number(params.id)).length })),
  );
});

const render = (query = 'step=write&who=1') =>
  renderWithProviders(<GmBoard gameId={GAME_ID} gameTitle="Starfall" phase={phase} />, { gameId: GAME_ID, initialRoute: `/games/${GAME_ID}/phases/${PHASE_ID}/board?${query}` });

/** Opens a tab of the Write step's result column (Result, Rewards, Checks); the others stay mounted but hidden. */
const openResultTab = async (user: ReturnType<typeof userEvent.setup>, name: 'Result' | 'Rewards' | 'Checks') =>
  user.click(within(await screen.findByRole('group', { name: 'Result pane' })).getByRole('button', { name: new RegExp(`^${name}`) }));

const rewardsSaved = (characterId: number, match: (doc: Record<string, unknown>) => boolean) =>
  waitFor(() => expect(boardSaves.some((c) => c.kind === 'rewards' && c.key === String(characterId) && !!c.doc && match(c.doc as Record<string, unknown>))).toBe(true), { timeout: 3000 });

describe('Write: rewards', () => {
  it('gives a reward from the list: the line, the block, the sheet change, and drafts saved on the result', async () => {
    const user = userEvent.setup();
    render();
    await openResultTab(user, 'Rewards');
    const panel = await screen.findByTestId('write-rewards');
    await user.click(await within(panel).findByRole('button', { name: '+ Partial' }));

    expect(await within(panel).findByText('Scenario result: Partial. 2 coin.')).toBeInTheDocument();
    expect(within(panel).getByTestId('reward-block')).toHaveTextContent('Coin: 3');
    expect(within(panel).getByTestId('reward-sheet')).toHaveTextContent('Coin: Amount 1 → 3');
    await rewardsSaved(1, (d) => (d.lines as { itemId?: string }[]).some((l) => l.itemId === 'rw-partial'));

    await waitFor(() => expect(syncs).toHaveLength(1), { timeout: 4000 });
    expect(syncs[0]).toMatchObject({ characterId: 1, body: { result_id: 100, updates: [{ module_type: 'numbers', field_name: 'numbers' }] } });
    expect(JSON.parse((syncs[0].body.updates as { field_value: string }[])[0].field_value)).toEqual([{ id: 'n1', name: 'Coin', amount: { value: 3 } }]);
    // The block isn't in the result yet: a check says so.
    await openResultTab(user, 'Checks');
    expect(within(screen.getByTestId('write-checks')).getByText(/The reward block isn’t in Harrison’s result/)).toBeInTheDocument();
  });

  it('Put block in result writes it at the end of the result, and replaces that copy next time', async () => {
    board.set('rewards/1', makeGmItem({ kind: 'rewards', key: '1', doc: { lines: [{ id: 'l1', itemId: 'rw-partial', group: 'result', text: partial.text, ops: partial.ops, choose: false }], texts: {} } }));
    const user = userEvent.setup();
    render();
    await user.click(await screen.findByTestId('put-block'));
    await waitFor(() => expect(resultPuts.at(-1)?.content).toBe('You wait by the wheel.\n\n# Rewards\n\n**Scenario result:** Partial. 2 coin.\n\nCoin: 3'), { timeout: 4000 });
    await rewardsSaved(1, (d) => typeof d.block === 'string' && d.block.endsWith('Coin: 3'));
    await waitFor(() => expect(screen.queryByText(/reward block isn’t in/)).not.toBeInTheDocument());
  });

  it('asks before replacing sheet updates made by hand, then replaces them', async () => {
    drafts = [draftRow({ from_rewards: false })];
    board.set('rewards/1', makeGmItem({ kind: 'rewards', key: '1', doc: { lines: [{ id: 'l1', group: 'result', text: 'Coin', ops: partial.ops, choose: false }], texts: {} } }));
    const user = userEvent.setup();
    render();
    // The question waits behind the Rewards tab, so the tab is flagged.
    const tabs = await screen.findByRole('group', { name: 'Result pane' });
    await waitFor(() => expect(within(tabs).getByRole('button', { name: /^Rewards/ })).toHaveTextContent('!'), { timeout: 4000 });
    await openResultTab(user, 'Rewards');
    const alert = await screen.findByTestId('reward-hand-made', {}, { timeout: 4000 });
    expect(alert).toHaveTextContent('(inventory)');
    expect(syncs).toHaveLength(0);
    await user.click(within(alert).getByRole('button', { name: 'Replace them' }));
    await waitFor(() => expect(syncs[0]?.body).toMatchObject({ result_id: 100, replace_hand_made: true }), { timeout: 4000 });
  });

  it('rewards with no result: kept, with a check, and nothing written', async () => {
    board.set('rewards/2', makeGmItem({ kind: 'rewards', key: '2', doc: { lines: [{ id: 'l2', group: 'result', text: 'Well done', ops: [], choose: false }], texts: {} } }));
    render('step=write&who=2');
    expect(await screen.findByText('Mara has rewards but no draft result to carry them.')).toBeInTheDocument();
    await new Promise((r) => setTimeout(r, 1500));
    expect(syncs).toHaveLength(0);
  });

  it('once published, the rewards are locked', async () => {
    results[0].is_published = true;
    board.set('rewards/1', makeGmItem({ kind: 'rewards', key: '1', doc: { lines: [{ id: 'l1', group: 'result', text: 'Coin', ops: partial.ops, choose: false }], texts: {}, carrierHeadId: 100 } }));
    render();
    expect(await screen.findByTestId('rewards-locked')).toHaveTextContent('the sheet changes are applied');
    expect(screen.queryByRole('button', { name: '+ Partial' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '+ Line' })).not.toBeInTheDocument();
  });

  it('the Rewards table gives and takes back a reward per character', async () => {
    const user = userEvent.setup();
    render('step=write&view=table');
    const table = await screen.findByTestId('rewards-table');
    const box = await within(table).findByRole('checkbox', { name: 'Partial for Mara' });
    await user.click(box);
    await rewardsSaved(2, (d) => (d.lines as { itemId?: string }[]).some((l) => l.itemId === 'rw-partial'));
    expect(within(screen.getByTestId('rewards-row-2')).getByRole('checkbox', { name: 'Partial for Mara' })).toBeChecked();
    await user.click(within(screen.getByTestId('rewards-row-2')).getByRole('checkbox', { name: 'Partial for Mara' }));
    await rewardsSaved(2, (d) => (d.lines as unknown[]).length === 0);
  });

  it('a sheet change that can’t apply is a check, and the line editor fixes it', async () => {
    board.set('rewards/1', makeGmItem({ kind: 'rewards', key: '1', doc: { lines: [{ id: 'l1', group: 'result', text: 'Gold', ops: [{ act: 'inc', tab: 'numbers', entry: 'Gold', by: 1 }], choose: false }], texts: {} } }));
    const user = userEvent.setup();
    render();
    const checks = await screen.findByTestId('write-checks');
    expect(await within(checks).findByText('There’s no Numbers entry named “Gold”', { exact: false })).toBeInTheDocument();
    await openResultTab(user, 'Rewards');
    await user.click(within(screen.getByTestId('reward-line-l1')).getByRole('button', { name: 'Edit' }));
    const editor = await screen.findByTestId('reward-line-editor');
    expect(within(editor).getByTestId('line-entry-0-tag')).toHaveTextContent('Not on the sheet');
    // Every field is labelled, so it can be found (and read out) by its name.
    expect(within(editor).getByLabelText('Tab')).toHaveValue('numbers');
    expect(within(editor).getByLabelText('By')).toHaveValue(1);
    expect(within(editor).getByLabelText('Section')).toHaveValue('result');
    await user.click(within(editor).getByRole('button', { name: /Show Entry options/ }));
    await user.click(await screen.findByRole('option', { name: 'Coin' }));
    await waitFor(() => expect(within(checks).queryByText(/no Numbers entry/)).not.toBeInTheDocument());
  });
});

describe('rewards from Read and Scenes', () => {
  it('+ Award gives a reward from the lists, keeping the passage', async () => {
    server.use(
      http.get(`/api/v1/games/${GAME_ID}/actions`, () =>
        HttpResponse.json([makeActionWithDetails({ id: 44, game_id: GAME_ID, phase_id: PHASE_ID, character_id: 1, content: 'I climb the wheel and cut the rope.' })]),
      ),
    );
    const user = userEvent.setup();
    render('who=1');
    const text = await screen.findByText(/I climb the wheel/);
    const range = document.createRange();
    range.setStart(text.firstChild as Text, 0);
    range.setEnd(text.firstChild as Text, 'I climb the wheel'.length);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);
    fireEvent.mouseUp(text);
    await user.click(within(await screen.findByTestId('selection-toolbar')).getByRole('button', { name: '+ Award' }));

    const dialog = await screen.findByTestId('award-dialog');
    expect(dialog).toHaveTextContent('“I climb the wheel”');
    await user.click(within(dialog).getByRole('button', { name: 'Partial' }));
    await rewardsSaved(1, (d) => (d.lines as { itemId?: string; quote?: string }[]).some((l) => l.itemId === 'rw-partial' && l.quote === 'I climb the wheel'));
  });

  it('+ Sheet update makes a line for someone in the scene, tied to it', async () => {
    board.set('scene/s1', makeGmItem({ kind: 'scene', key: 's1', doc: { title: 'At the mill', locationId: '', chunkId: 'k1', conflict: false, participants: [1, 2], moments: [], effects: [] } }));
    const user = userEvent.setup();
    render('step=scenes&scene=s1');
    const row = await screen.findByTestId('scene-rewards');
    await user.selectOptions(within(row).getByTestId('scene-add-reward'), '2');
    const editor = await screen.findByTestId('reward-line-editor');
    expect(editor).toHaveTextContent('From the scene At the mill.');
    await user.type(within(editor).getByTestId('line-text'), 'Found the ledger');
    await user.click(within(editor).getByRole('button', { name: 'Done' }));
    await rewardsSaved(2, (d) => (d.lines as { sceneId?: string; text: string }[]).some((l) => l.sceneId === 's1' && l.text === 'Found the ledger'));
    expect(await within(row).findByText(/Mara: Found the ledger/)).toBeInTheDocument();
  });
});
