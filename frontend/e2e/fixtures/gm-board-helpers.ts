import type { Page, TestInfo } from '@playwright/test';
import type { BoardItemKind, GmItem, SettingsItemKind } from '../../src/types/gmBoard';

/**
 * API helpers for the results board specs (e2e/gm-board/).
 *
 * The arrange helpers write through the board's real save endpoints, with
 * the versions the server has now, so a test can put a seeded item into a
 * known state before it starts. That's what keeps a retry honest: the
 * second attempt starts where the first did, not where it stopped.
 * Everything runs in the page, so the logged-in user's session is used.
 */

/** A unique-per-attempt tag for names a test writes, e.g. a time slot it adds. */
export function runTag(testInfo: TestInfo): string {
  return `e2e${testInfo.workerIndex}r${testInfo.retry}${Date.now().toString(36)}`;
}

/** The game's action phase: the one with the board. */
export async function boardPhaseId(page: Page, gameId: number): Promise<number> {
  return page.evaluate(async (gid) => {
    const res = await fetch(`/api/v1/games/${gid}/phases`, { credentials: 'include' });
    if (!res.ok) throw new Error(`Failed to fetch phases: ${res.status}`);
    const phases: Array<{ id: number; phase_type: string }> = await res.json();
    const phase = phases.find((p) => p.phase_type === 'action');
    if (!phase) throw new Error('The results board fixture has no action phase');
    return phase.id;
  }, gameId);
}

/** The game's characters by name (the Heist's cast in every board fixture). */
export async function characterIds(page: Page, gameId: number): Promise<Record<string, number>> {
  return page.evaluate(async (gid) => {
    const res = await fetch(`/api/v1/games/${gid}/characters`, { credentials: 'include' });
    if (!res.ok) throw new Error(`Failed to fetch characters: ${res.status}`);
    const characters: Array<{ id: number; name: string }> = await res.json();
    return Object.fromEntries(characters.map((c) => [c.name, c.id]));
  }, gameId);
}

/** Every live item on a phase's board, as the server has it. */
export async function boardItems(page: Page, gameId: number, phaseId: number): Promise<GmItem[]> {
  return page.evaluate(
    async ({ gid, pid }) => {
      const res = await fetch(`/api/v1/games/${gid}/phases/${pid}/gm-board`, { credentials: 'include' });
      if (!res.ok) throw new Error(`Failed to fetch the board: ${res.status}`);
      return (await res.json()).items;
    },
    { gid: gameId, pid: phaseId },
  );
}

/** One live board item, or undefined. */
export async function boardItem(page: Page, gameId: number, phaseId: number, kind: BoardItemKind, key: string) {
  return (await boardItems(page, gameId, phaseId)).find((i) => i.kind === kind && i.key === key);
}

/** Every live settings item (codex, names, template, reward lists, ...). */
export async function settingsItems(page: Page, gameId: number): Promise<GmItem[]> {
  return page.evaluate(async (gid) => {
    const res = await fetch(`/api/v1/games/${gid}/gm-settings`, { credentials: 'include' });
    if (!res.ok) throw new Error(`Failed to fetch board settings: ${res.status}`);
    return (await res.json()).items;
  }, gameId);
}

/** An item to put in place: its whole doc, or deleted. */
export type ArrangedItem<K extends string> = { kind: K; key: string } & ({ doc: unknown } | { deleted: true });

/**
 * Writes items in one batch at the server's current versions. Use it to set
 * seeded items a test changes back to their starting state, or to delete
 * what an earlier attempt made.
 */
async function arrange(page: Page, listUrl: string, saveUrl: string, items: ArrangedItem<string>[]) {
  if (items.length === 0) return;
  await page.evaluate(
    async ({ listUrl, saveUrl, items }) => {
      // A poll from the start (since=0 would be a full load, which leaves out
      // tombstones), so a deleted item reads as deleted rather than missing.
      const list = await fetch(`${listUrl}?since=1`, { credentials: 'include' });
      if (!list.ok) throw new Error(`Failed to read items: ${list.status}`);
      const current: Array<{ kind: string; key: string; version: number; deleted: boolean }> = (await list.json()).items;
      const version = (kind: string, key: string) => {
        const item = current.find((i) => i.kind === kind && i.key === key);
        return item && !item.deleted ? item.version : 0;
      };
      const changes = items
        .map((item) => ({ ...item, base_version: version(item.kind, item.key) }))
        // Deleting what isn't there is a no-op, not a change.
        .filter((c) => !('deleted' in c) || c.base_version > 0);
      if (changes.length === 0) return;
      const res = await fetch(saveUrl, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ changes }),
      });
      if (!res.ok) throw new Error(`Arrange failed: ${res.status} ${await res.text()}`);
    },
    { listUrl, saveUrl, items },
  );
}

export function arrangeBoard(page: Page, gameId: number, phaseId: number, items: ArrangedItem<BoardItemKind>[]) {
  const base = `/api/v1/games/${gameId}/phases/${phaseId}/gm-board`;
  return arrange(page, base, `${base}/changes`, items);
}

export function arrangeSettings(page: Page, gameId: number, items: ArrangedItem<SettingsItemKind>[]) {
  const base = `/api/v1/games/${gameId}/gm-settings`;
  return arrange(page, base, `${base}/changes`, items);
}

/** Share the game's boards with the audience, or stop. */
export async function setBoardSharing(page: Page, gameId: number, share: boolean) {
  await page.evaluate(
    async ({ gid, share }) => {
      const res = await fetch(`/api/v1/games/${gid}/gm-settings/sharing`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ share }),
      });
      if (!res.ok) throw new Error(`Failed to set sharing: ${res.status}`);
    },
    { gid: gameId, share },
  );
}

// ── Items a test makes for itself ────────────────────────────────────────
// Docs in the shapes the board writes (src/lib/gmBoard/types.ts; the id is
// the item key, not part of the doc).

/**
 * A position after the Heist's four time slots (1-4) and after every slot an
 * earlier test or attempt added, so a test's slots are the last columns and
 * sit in the order it gives them (`base + 0.1`, `base + 0.2`, ...).
 */
export function freshSlotPosition(): number {
  return 10 + (Date.now() % 1e9) / 1000;
}

/** A time slot after the Heist's four, so the seeded Map is unchanged. */
export function timeSlot(key: string, name: string, position = freshSlotPosition()): ArrangedItem<BoardItemKind> {
  return { kind: 'chunk', key, doc: { name, position } };
}

/** A GM card ("+ Card") with no outcome yet. */
export function gmCard(
  key: string,
  card: { characterId: number; locationId: string; chunkId: string | null; summary: string; isIF?: boolean; cond?: string; causedBy?: string[] },
): ArrangedItem<BoardItemKind> {
  return {
    kind: 'card',
    key,
    doc: {
      characterId: card.characterId,
      quote: '',
      summary: card.summary,
      note: '',
      locationId: card.locationId,
      chunkId: card.chunkId,
      outcome: 'pending',
      causedBy: card.causedBy ?? [],
      isIF: card.isIF ?? false,
      cond: card.cond ?? '',
      branchOf: null,
      src: [],
      gm: true,
    },
  };
}

/** Heist codex location keys (common/02_gm_board_seed.sql). */
export const HEIST_LOCATIONS = {
  lobby: 'cx-heist-lobby',
  vault: 'cx-heist-vault',
  rooftop: 'cx-heist-rooftop',
  alley: 'cx-heist-alley',
  ducts: 'cx-heist-ducts',
} as const;

/** Writes a draft result for a character, as the results area would. Returns its id. */
export async function createDraftResult(page: Page, gameId: number, characterName: string, content: string): Promise<number> {
  return page.evaluate(
    async ({ gid, name, content }) => {
      const list = await fetch(`/api/v1/games/${gid}/characters`, { credentials: 'include' });
      const character = ((await list.json()) as Array<{ id: number; name: string; user_id?: number }>).find((c) => c.name === name);
      if (!character?.user_id) throw new Error(`No played character named ${name}`);
      const res = await fetch(`/api/v1/games/${gid}/results`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: character.user_id, character_id: character.id, content, is_published: false }),
      });
      if (!res.ok) throw new Error(`Failed to create a result: ${res.status} ${await res.text()}`);
      return (await res.json()).id;
    },
    { gid: gameId, name: characterName, content },
  );
}

/** A Numbers entry's amount on a character's sheet. */
export async function sheetNumber(page: Page, characterId: number, entry: string): Promise<number | undefined> {
  return page.evaluate(
    async ({ cid, entry }) => {
      const res = await fetch(`/api/v1/characters/${cid}/data`, { credentials: 'include' });
      if (!res.ok) throw new Error(`Failed to read the sheet: ${res.status}`);
      const rows: Array<{ module_type: string; field_value: string }> = await res.json();
      const numbers = rows.find((r) => r.module_type === 'numbers');
      // A track value ({value, max?, display?}); older rows hold a flat number.
      const list: Array<{ name: string; amount: number | { value: number } }> = numbers ? JSON.parse(numbers.field_value) : [];
      const amount = list.find((n) => n.name === entry)?.amount;
      return typeof amount === 'object' ? amount.value : amount;
    },
    { cid: characterId, entry },
  );
}

/**
 * Deletes a character's draft results in a phase (each chain from its head),
 * so a test that types a first result starts from "nothing written".
 * Published results stay: they can't be deleted.
 */
export async function deleteDraftResults(page: Page, gameId: number, phaseId: number, characterId: number) {
  await page.evaluate(
    async ({ gid, pid, cid }) => {
      const res = await fetch(`/api/v1/games/${gid}/results`, { credentials: 'include' });
      if (!res.ok) throw new Error(`Failed to list results: ${res.status}`);
      const results: Array<{ id: number; phase_id: number; character_id?: number; is_published: boolean; parent_result_id?: number | null }> = await res.json();
      const heads = results.filter((r) => r.phase_id === pid && r.character_id === cid && !r.is_published && !r.parent_result_id);
      for (const head of heads) {
        const del = await fetch(`/api/v1/games/${gid}/results/${head.id}`, { method: 'DELETE', credentials: 'include' });
        if (!del.ok) throw new Error(`Failed to delete result ${head.id}: ${del.status}`);
      }
    },
    { gid: gameId, pid: phaseId, cid: characterId },
  );
}

/** A scene with no moments or effects yet (Create scene on the Map makes the same). */
export function scene(
  key: string,
  s: { title: string; locationId: string; chunkId: string; participants: number[]; conflict?: boolean },
): ArrangedItem<BoardItemKind> {
  return { kind: 'scene', key, doc: { title: s.title, locationId: s.locationId, chunkId: s.chunkId, conflict: s.conflict ?? false, participants: s.participants, moments: [], effects: [] } };
}
