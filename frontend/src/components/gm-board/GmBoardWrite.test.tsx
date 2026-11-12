import { describe, it, expect, beforeEach } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';
import { renderWithProviders } from '@/test-utils/render';
import { makeActionResult, makeActionWithDetails, makeCharacter, makeGamePhase, makeGameWithDetails, makeGmItem } from '@/test-utils/factories';
import type { BoardItemChange, GmItem } from '@/types/gmBoard';
import type { ActionResult } from '@/types/phases';
import { GmBoard } from './GmBoard';

// Hand-written test data; never player content.
const GAME_ID = 7;
const PHASE_ID = 70;
const phase = makeGamePhase({ id: PHASE_ID, game_id: GAME_ID, phase_type: 'action', title: 'Day 2' });
const BOARD = `/api/v1/games/${GAME_ID}/phases/${PHASE_ID}/gm-board`;
const RESULTS = `/api/v1/games/${GAME_ID}/results`;

let board: Map<string, GmItem>;
let boardSaves: BoardItemChange[];
let seq: number;
let results: ActionResult[];
let nextId: number;
const calls: { method: string; path: string; body?: Record<string, unknown> }[] = [];

const item = (kind: string, key: string, doc: Record<string, unknown>) => [`${kind}/${key}`, makeGmItem({ kind, key, doc })] as const;
const cardDoc = (doc: Record<string, unknown>) => ({
  quote: '', summary: '', note: '', locationId: 'mill', chunkId: 'k2', outcome: 'happened', causedBy: [], isIF: false, cond: '', branchOf: null, src: [], gm: false, ...doc,
});
const sceneDoc = (doc: Record<string, unknown>) => ({ title: 'At the mill', locationId: 'mill', chunkId: 'k2', conflict: false, participants: [], moments: [], effects: [], ...doc });
const stamp = (n: number) => `2026-11-03T10:00:${String(n).padStart(2, '0')}.000001Z`;

beforeEach(() => {
  seq = 10;
  nextId = 100;
  boardSaves = [];
  calls.length = 0;
  results = [];
  board = new Map([
    item('chunk', 'k1', { name: 'Pre-Scenario', position: 1 }),
    item('chunk', 'k2', { name: 'Slot 1', position: 2 }),
    item('card', 'c-h', cardDoc({ characterId: 1, summary: 'Waits by the wheel' })),
    item(
      'scene',
      's1',
      sceneDoc({
        participants: [1, 2],
        moments: [
          { id: 'm1', text: 'Harrison waits by the wheel.', readers: [1, 2], ownText: {} },
          { id: 'm2', text: 'Mara palms the ledger key.', readers: [2], ownText: {} },
        ],
      }),
    ),
  ]);
  const settings = new Map([
    item('codex', 'mill', { type: 'Location', name: 'the Old Mill' }),
    item('codex', 'orrin', { type: 'Person', name: 'Orrin', secret: true, knownBy: [2] }),
  ]);
  const record = async (method: string, request: Request) => {
    const body = method === 'DELETE' ? undefined : ((await request.json().catch(() => undefined)) as Record<string, unknown> | undefined);
    calls.push({ method, path: new URL(request.url).pathname, body });
    return body ?? {};
  };
  server.use(
    http.get(`/api/v1/games/${GAME_ID}/details`, () => HttpResponse.json(makeGameWithDetails({ id: GAME_ID, gm_user_id: 1, state: 'in_progress' }))),
    http.get(`/api/v1/games/${GAME_ID}/characters`, () =>
      HttpResponse.json([
        makeCharacter({ id: 1, game_id: GAME_ID, name: 'Harrison Vale', user_id: 11 }),
        makeCharacter({ id: 2, game_id: GAME_ID, name: 'Mara', user_id: 12 }),
        makeCharacter({ id: 3, game_id: GAME_ID, name: 'Tom Brewer', character_type: 'npc', user_id: undefined, assigned_user_id: 13 }),
        makeCharacter({ id: 4, game_id: GAME_ID, name: 'The Watch', character_type: 'npc', user_id: undefined }),
      ]),
    ),
    http.get(`/api/v1/games/${GAME_ID}/actions`, () =>
      HttpResponse.json([makeActionWithDetails({ id: 44, game_id: GAME_ID, phase_id: PHASE_ID, character_id: 1, content: 'I wait by the wheel.' })]),
    ),
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
    http.get(`/api/v1/games/${GAME_ID}/phases/${PHASE_ID}/results/unpublished-count`, () =>
      HttpResponse.json({ count: results.filter((r) => !r.is_published && r.parent_result_id === undefined).length }),
    ),
    http.post(RESULTS, async ({ request }) => {
      const body = await record('POST', request);
      const created = makeActionResult({ id: ++nextId, game_id: GAME_ID, phase_id: PHASE_ID, ...body, updated_at: stamp(nextId % 60) } as Partial<ActionResult>);
      results.push(created);
      return HttpResponse.json(created, { status: 201 });
    }),
    http.put(`${RESULTS}/:id`, async ({ request, params }) => {
      const body = await record('PUT', request);
      const r = results.find((x) => x.id === Number(params.id))!;
      if (body.expected_updated_at && body.expected_updated_at !== r.updated_at) {
        return HttpResponse.json({ status: 409, title: 'Conflict', detail: 'Someone else saved this result after you opened it' }, { status: 409 });
      }
      Object.assign(r, { content: body.content, updated_at: stamp(++seq % 60) });
      return HttpResponse.json(r);
    }),
    http.post(`${RESULTS}/:id/parts`, async ({ request, params }) => {
      const body = await record('POST', request);
      const part = makeActionResult({ id: ++nextId, phase_id: PHASE_ID, character_id: 1, parent_result_id: Number(params.id), content: String(body.content), updated_at: stamp(1) });
      results.push(part);
      return HttpResponse.json(part, { status: 201 });
    }),
    http.post(`${RESULTS}/:id/publish`, async ({ request, params }) => {
      await record('POST', request);
      const r = results.find((x) => x.id === Number(params.id))!;
      r.is_published = true;
      return HttpResponse.json(r);
    }),
    http.delete(`${RESULTS}/:id`, async ({ request, params }) => {
      await record('DELETE', request);
      results = results.filter((x) => x.id !== Number(params.id) && x.parent_result_id !== Number(params.id));
      return new HttpResponse(null, { status: 204 });
    }),
  );
});

const renderWrite = (who?: number) =>
  renderWithProviders(<GmBoard gameId={GAME_ID} gameTitle="Starfall" phase={phase} />, {
    gameId: GAME_ID,
    initialRoute: `/games/${GAME_ID}/phases/${PHASE_ID}/board?step=write${who ? `&who=${who}` : ''}`,
  });

const draftBox = () => screen.findByTestId('result-draft') as Promise<HTMLTextAreaElement>;
const progressSaved = (id: number, match: (doc: Record<string, unknown>) => boolean) =>
  waitFor(() => expect(boardSaves.some((c) => c.kind === 'progress' && c.key === String(id) && !!c.doc && match(c.doc as Record<string, unknown>))).toBe(true), { timeout: 3000 });

describe('GmBoardWrite', () => {
  it('lists everyone who can get a result, including an assigned NPC, not only those who submitted', async () => {
    renderWrite();
    const list = await screen.findByTestId('write-player-list');
    await waitFor(() => expect(within(list).getAllByRole('button').map((b) => b.textContent)).toHaveLength(3));
    expect(list).toHaveTextContent('Harrison');
    expect(list).toHaveTextContent('Mara');
    expect(list).toHaveTextContent('Tom');
    expect(list).not.toHaveTextContent('The Watch');
    expect(list).toHaveTextContent('not started');
  });

  it('makes the first result on the first keystroke, answering the submission, then saves with updated_at', async () => {
    renderWrite(1);
    const box = await draftBox();
    fireEvent.change(box, { target: { value: 'You wait.' } });
    await waitFor(() => expect(calls.some((c) => c.method === 'POST' && c.path === RESULTS)).toBe(true), { timeout: 3000 });
    expect(calls.find((c) => c.method === 'POST')?.body).toMatchObject({ user_id: 11, character_id: 1, action_submission_id: 44, content: 'You wait.', is_published: false });

    const createdAt = results[0].updated_at;
    fireEvent.change(await draftBox(), { target: { value: 'You wait by the wheel.' } });
    await waitFor(() => expect(calls.some((c) => c.method === 'PUT')).toBe(true), { timeout: 3000 });
    const put = calls.find((c) => c.method === 'PUT')!;
    expect(put.path).toBe(`${RESULTS}/101`);
    expect(put.body).toEqual({ content: 'You wait by the wheel.', expected_updated_at: createdAt });
    expect(screen.getByTestId('result-draft')).toHaveValue('You wait by the wheel.');
  });

  // Regression: the editor moved from the "new result" box into the result's
  // card once it was made, so React remounted it mid-typing (focus lost,
  // save state reset).
  it('keeps the same editor, focused, once the first keystroke has made the result', async () => {
    renderWrite(1);
    const box = await draftBox();
    box.focus();
    fireEvent.change(box, { target: { value: 'You wait.' } });
    await waitFor(() => expect(screen.getByTestId('result-chain-101')).toBeInTheDocument(), { timeout: 3000 });
    expect(screen.getByTestId('result-draft')).toBe(box);
    expect(box).toHaveFocus();
    expect(screen.getByTestId('result-draft-status')).toHaveTextContent('Result 1 · Saved');
  });

  it('shows the brief as the reader gets it; Insert puts the moment in the draft and ticks it', async () => {
    renderWrite(1);
    const brief = await screen.findByTestId('write-brief');
    expect(within(brief).getByTestId('brief-card-c-h')).toHaveTextContent('Waits by the wheel');
    expect(within(brief).getByTestId('brief-moment-m1')).toHaveTextContent('You wait by the wheel.');
    expect(within(brief).getByTestId('brief-hidden-m2')).toHaveTextContent('Harrison doesn’t get this');

    await userEvent.click(within(within(brief).getByTestId('brief-moment-m1')).getByRole('button', { name: 'Insert' }));
    expect(await draftBox()).toHaveValue('You wait by the wheel.');
    await progressSaved(1, (doc) => (doc.covered as Record<string, boolean>)?.m1 === true);
    expect(brief).toHaveTextContent('1 of 1 moments covered');
  });

  it('Insert from the brief brings the draft back into view when another tab is open', async () => {
    renderWrite(1);
    const brief = await screen.findByTestId('write-brief');
    const tabs = screen.getByRole('group', { name: 'Result pane' });
    await userEvent.click(within(tabs).getByRole('button', { name: /^Checks/ }));
    expect(within(tabs).getByRole('button', { name: /^Checks/ })).toHaveAttribute('aria-pressed', 'true');

    await userEvent.click(within(within(brief).getByTestId('brief-moment-m1')).getByRole('button', { name: 'Insert' }));
    expect(within(tabs).getByRole('button', { name: /^Result/ })).toHaveAttribute('aria-pressed', 'true');
    expect(await draftBox()).toHaveValue('You wait by the wheel.');
    expect(await draftBox()).toBeVisible();
  });

  it('flags a secret the character may not know before publishing', async () => {
    renderWrite(1);
    fireEvent.change(await draftBox(), { target: { value: 'Orrin is watching.' } });
    const checks = screen.getByTestId('write-checks');
    await waitFor(() => expect(within(checks).getByTestId('write-check-leak')).toHaveTextContent('“Orrin”'));
    expect(checks).toHaveTextContent('1 not covered');
  });

  it('shows a staged chain, adds a part with its delay, and starts another result without the submission', async () => {
    results = [
      makeActionResult({ id: 21, phase_id: PHASE_ID, character_id: 1, user_id: 11, content: 'Part one.', part_number: 1, part_count: 2, updated_at: stamp(1) }),
      makeActionResult({ id: 22, phase_id: PHASE_ID, character_id: 1, user_id: 11, content: 'Part two.', part_number: 2, part_count: 2, parent_result_id: 21, reveal_delay_minutes: 15, updated_at: stamp(1) }),
    ];
    renderWrite(1);
    const chain = await screen.findByTestId('result-chain-21');
    expect(within(chain).getByText('Part 1 of 2')).toBeInTheDocument();
    expect(within(chain).getByRole('button', { name: 'Publish (2 parts)' })).toBeInTheDocument();
    expect(within(chain).getByTestId('edit-staged-delay-22')).toHaveValue('15');
    // The editor opens on the newest draft's last part.
    expect(await draftBox()).toHaveValue('Part two.');

    await userEvent.click(within(chain).getByRole('button', { name: '+ Part' }));
    await userEvent.selectOptions(await screen.findByTestId('new-part-delay'), '30');
    fireEvent.change(await draftBox(), { target: { value: 'Part three.' } });
    await waitFor(() => expect(calls.some((c) => c.path === `${RESULTS}/22/parts`)).toBe(true), { timeout: 3000 });
    expect(calls.find((c) => c.path === `${RESULTS}/22/parts`)?.body).toEqual({ content: 'Part three.', delay_minutes: 30 });

    await userEvent.click(screen.getByRole('button', { name: '+ Another result' }));
    fireEvent.change(await draftBox(), { target: { value: 'A second result.' } });
    await waitFor(() => expect(calls.some((c) => c.method === 'POST' && c.path === RESULTS)).toBe(true), { timeout: 3000 });
    expect(calls.find((c) => c.method === 'POST' && c.path === RESULTS)?.body).not.toHaveProperty('action_submission_id');
  });

  it('publishes a result and deletes a draft, each after confirming', async () => {
    results = [
      makeActionResult({ id: 31, phase_id: PHASE_ID, character_id: 1, user_id: 11, content: 'One.', updated_at: stamp(1) }),
      makeActionResult({ id: 32, phase_id: PHASE_ID, character_id: 1, user_id: 11, content: 'Two.', updated_at: stamp(1) }),
    ];
    renderWrite(1);
    await userEvent.click(within(await screen.findByTestId('result-chain-31')).getByRole('button', { name: 'Publish' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Publish' }));
    await waitFor(() => expect(calls.some((c) => c.path === `${RESULTS}/31/publish`)).toBe(true));
    await waitFor(() => expect(within(screen.getByTestId('result-chain-31')).getByText('Published')).toBeInTheDocument());

    await userEvent.click(within(screen.getByTestId('result-chain-32')).getByRole('button', { name: 'Delete' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Yes, Delete Draft' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'DELETE' && c.path === `${RESULTS}/32`)).toBe(true));
    await waitFor(() => expect(screen.queryByTestId('result-chain-32')).not.toBeInTheDocument());
  });

  it('keeps the GM’s text on a stale save and offers theirs', async () => {
    results = [makeActionResult({ id: 41, phase_id: PHASE_ID, character_id: 1, user_id: 11, content: 'Mine.', updated_at: stamp(1) })];
    renderWrite(1);
    const box = await draftBox();
    // A co-GM saves first.
    Object.assign(results[0], { content: 'Theirs.', updated_at: stamp(30) });
    fireEvent.change(box, { target: { value: 'Mine, edited.' } });
    expect(await screen.findByText('Someone else saved this part', {}, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.getByTestId('result-draft')).toHaveValue('Mine, edited.');
    await userEvent.click(screen.getByRole('button', { name: 'Use theirs' }));
    expect(screen.getByTestId('result-draft')).toHaveValue('Theirs.');
  });

  it('Make “you” rewrites the draft for the reader', async () => {
    results = [makeActionResult({ id: 51, phase_id: PHASE_ID, character_id: 1, user_id: 11, content: 'Harrison waits. Harrison’s hat falls.', updated_at: stamp(1) })];
    renderWrite(1);
    await draftBox();
    await userEvent.click(screen.getByRole('button', { name: 'Make “you”' }));
    expect(screen.getByTestId('result-draft')).toHaveValue('You wait. Your hat falls.');
  });

  it('Ready → next marks them ready and opens the next person not ready; Reopen undoes it', async () => {
    board.set('progress/2', makeGmItem({ kind: 'progress', key: '2', doc: { ready: true } }));
    const { router } = renderWrite(1);
    await userEvent.click(await screen.findByRole('button', { name: 'Ready → next' }));
    await progressSaved(1, (doc) => doc.ready === true);
    // Mara is ready already, so Tom is next.
    await waitFor(() => expect(router.state.location.search).toContain('who=3'));

    await userEvent.click(within(screen.getByTestId('write-player-list')).getByRole('button', { name: /Harrison/ }));
    await userEvent.click(await screen.findByRole('button', { name: 'Reopen' }));
    await progressSaved(1, (doc) => doc.ready === false);
  });
});
