import { describe, it, expect, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';
import { renderWithProviders } from '@/test-utils/render';
import { makeGmItem } from '@/test-utils/factories';
import type { GmItem, SettingsItemChange } from '@/types/gmBoard';
import { GmCodexManager } from './GmCodexManager';

const GAME_ID = 7;
const SETTINGS = `/api/v1/games/${GAME_ID}/gm-settings`;
const phases = [
  { id: 70, title: 'Day 1' },
  { id: 71, title: 'Day 2' },
];
const players = [
  { id: 1, name: 'Harrison Vale' },
  { id: 2, name: 'Mara' },
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
      const items = changes.map((c, i) =>
        makeGmItem({ kind: c.kind, key: c.key, version: c.base_version + 1, seq: 10 + saves.length * 10 + i, doc: c.doc, deleted: !!c.deleted }),
      );
      return HttpResponse.json({ items });
    }),
  );
});

const savedChanges = () => saves.flat();
const waitForSave = (n = 1) => waitFor(() => expect(saves.length).toBeGreaterThanOrEqual(n), { timeout: 3000 });

const mill = (overrides: Record<string, unknown> = {}) =>
  makeGmItem({ kind: 'codex', key: 'cx-mill', doc: { type: 'Location', name: 'The Old Mill', aliases: ['mill'], ...overrides } });

describe('GmCodexManager', () => {
  it('adds a location for every phase', async () => {
    renderWithProviders(<GmCodexManager gameId={GAME_ID} phases={phases} players={players} />);
    expect(await screen.findByText(/The codex is empty/)).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Name'), 'The Old Mill');
    await userEvent.type(screen.getByLabelText(/Other names/), 'mill, the wheel');
    await userEvent.click(screen.getByRole('button', { name: 'Add to codex' }));

    expect(await screen.findByText('The Old Mill')).toBeInTheDocument();
    expect(screen.getByText(/Every phase · also mill, the wheel/)).toBeInTheDocument();
    await waitForSave();
    expect(savedChanges()[0]).toMatchObject({
      kind: 'codex',
      base_version: 0,
      doc: { type: 'Location', name: 'The Old Mill', aliases: ['mill', 'the wheel'], phases: [], secret: false, knownBy: [] },
    });
    expect(savedChanges()[0].doc).not.toHaveProperty('id');
  });

  it('on a board, scopes a new entry to the phase and hides other phases’ entries', async () => {
    stored = [mill({ phases: [70] })];
    renderWithProviders(
      <GmCodexManager gameId={GAME_ID} phases={phases} players={players} phaseId={71} initialName="the ledger" />,
    );
    expect(await screen.findByLabelText('Name')).toHaveValue('the ledger');
    expect(screen.queryByText('The Old Mill')).not.toBeInTheDocument();
    await userEvent.click(screen.getByLabelText('Show entries for other phases (1 hidden)'));
    expect(screen.getByText('The Old Mill')).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText('Type'), 'Item');
    expect(screen.getByLabelText('Day 2 only')).toBeChecked();
    await userEvent.click(screen.getByRole('button', { name: 'Add to codex' }));
    await waitForSave();
    expect(savedChanges()[0].doc).toMatchObject({ type: 'Item', name: 'the ledger', phases: [71] });
  });

  it('edits an entry in place: secret, allowed to know, phases', async () => {
    stored = [mill()];
    renderWithProviders(<GmCodexManager gameId={GAME_ID} phases={phases} players={players} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Edit The Old Mill' }));
    const editor = screen.getByTestId('codex-editor-cx-mill');

    expect(within(editor).queryByText('Allowed to know')).not.toBeInTheDocument();
    await userEvent.click(within(editor).getByLabelText('Secret'));
    await userEvent.click(within(editor).getByLabelText('Mara'));
    await userEvent.click(within(editor).getByLabelText('Day 2'));
    expect(within(editor).getByLabelText('Every phase')).not.toBeChecked();

    await waitForSave();
    await waitFor(() =>
      expect(savedChanges().at(-1)?.doc).toMatchObject({ secret: true, knownBy: [2], phases: [71], name: 'The Old Mill' }),
    );
  });

  it('deletes an entry with Undo, warning that cards there need a new location', async () => {
    stored = [mill()];
    renderWithProviders(<GmCodexManager gameId={GAME_ID} phases={phases} players={players} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Edit The Old Mill' }));
    await userEvent.click(screen.getByRole('button', { name: 'Delete entry' }));

    expect(screen.getByText(/Deleted “The Old Mill”. Cards placed there will need a new location./)).toBeInTheDocument();
    expect(screen.queryByTestId('codex-entry-cx-mill')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(await screen.findByTestId('codex-entry-cx-mill')).toBeInTheDocument();
  });

  it('lets a viewer look but not change anything', async () => {
    stored = [mill()];
    renderWithProviders(<GmCodexManager gameId={GAME_ID} phases={phases} players={players} readOnly />);
    expect(await screen.findByText('The Old Mill')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add to codex' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'View The Old Mill' }));
    expect(screen.queryByRole('button', { name: 'Delete entry' })).not.toBeInTheDocument();
  });
});
