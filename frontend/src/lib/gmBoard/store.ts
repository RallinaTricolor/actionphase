/**
 * The GM board's item store: pure functions over the client's copy of a
 * board's (or a game's settings') stored items. No React and no I/O; the hooks
 * in `hooks/useGmBoard.ts` hold a `StoreState` in React Query and call these.
 *
 * The model:
 * - `server` is the last copy of each item the server gave us, tombstones
 *   included (their version is what recreating a fixed-key item is based on).
 * - `dirty` is local edits not yet saved, each with the version it is based
 *   on. What a component sees is `server` with `dirty` laid over it.
 * - A save sends every dirty edit at once. The server applies the batch or
 *   nothing; a 409 names the items someone else changed, and only those are
 *   replaced. Every other edit stays dirty and is sent again.
 * - Polls (`since` the cursor) never overwrite a dirty edit: the edit wins
 *   locally, and its stale base version makes its next save a conflict, which
 *   is how the GM hears about it.
 */

import type { GmItem } from '@/types/gmBoard';
import type {
  BoardDoc,
  Card,
  CharacterProgress,
  Chunk,
  Cluster,
  CodexEntry,
  GameBoardSettings,
  Scene,
  Stance,
} from './types';

/** The notes item's fixed key: one per board. */
export const NOTES_KEY = 'notes';

export interface DirtyEdit {
  kind: string;
  key: string;
  /** The server version this edit replaces; 0 for an item that doesn't exist. */
  baseVersion: number;
  doc?: unknown;
  deleted: boolean;
  /** Bumped on every edit, so a save can tell whether an edit changed while it was in flight. */
  rev: number;
}

export interface StoreState {
  server: Record<string, GmItem>;
  dirty: Record<string, DirtyEdit>;
  cursor: number;
  /** A save is in flight. Kept here, not in a hook, so two components can't both send the same edits. */
  saving: boolean;
  /** Why the last save failed, until the next one succeeds. */
  saveError: string | null;
  /**
   * Edits dropped because someone else changed the same item first. Shown to
   * the GM with "Use mine" (`reapplyLost`) until dismissed.
   */
  lost: DirtyEdit[];
}

/** An item as a component sees it: the local edit if there is one, else the server's. */
export interface LiveItem {
  kind: string;
  key: string;
  doc: unknown;
}

export interface ChangeRequest {
  kind: string;
  key: string;
  base_version: number;
  doc?: unknown;
  deleted?: boolean;
}

export const itemId = (kind: string, key: string) => `${kind}/${key}`;

/**
 * A key for a new card, scene, codex entry and so on: time first, so keys
 * sort in the order items were made, then a random tail so two editors
 * creating at the same moment don't collide. Fits the server's key rule.
 */
export function newItemKey(prefix: string, now: number = Date.now(), random: () => number = Math.random): string {
  const time = now.toString(36).padStart(9, '0');
  const tail = Math.floor(random() * 36 ** 5).toString(36).padStart(5, '0');
  return `${prefix}-${time}${tail}`;
}

export function loadState(items: GmItem[], cursor: number): StoreState {
  const state: StoreState = { server: {}, dirty: {}, cursor: 0, saving: false, saveError: null, lost: [] };
  return mergeServerItems(state, items, cursor);
}

/**
 * Takes in items from a poll or a save. An item replaces our copy only if it
 * is at least as new (by seq), so a slow poll can't undo a save that landed
 * after it was read. Dirty edits are left alone.
 */
export function mergeServerItems(state: StoreState, items: GmItem[], cursor?: number): StoreState {
  let server = state.server;
  for (const item of items) {
    const id = itemId(item.kind, item.key);
    const have = server[id];
    if (have && have.seq > item.seq) continue;
    if (server === state.server) server = { ...server };
    server[id] = item;
  }
  const nextCursor = cursor === undefined ? state.cursor : Math.max(state.cursor, cursor);
  if (server === state.server && nextCursor === state.cursor) return state;
  return { ...state, server, cursor: nextCursor };
}

/** The current doc for one item, or undefined if it doesn't exist. */
export function getDoc<T = unknown>(state: StoreState, kind: string, key: string): T | undefined {
  const id = itemId(kind, key);
  const edit = state.dirty[id];
  if (edit) return edit.deleted ? undefined : (edit.doc as T);
  const item = state.server[id];
  return item && !item.deleted ? (item.doc as T) : undefined;
}

/** Every live item, local edits applied. */
export function liveItems(state: StoreState): LiveItem[] {
  const out: LiveItem[] = [];
  const ids = new Set([...Object.keys(state.server), ...Object.keys(state.dirty)]);
  for (const id of ids) {
    const edit = state.dirty[id];
    if (edit) {
      if (!edit.deleted) out.push({ kind: edit.kind, key: edit.key, doc: edit.doc });
      continue;
    }
    const item = state.server[id];
    if (!item.deleted) out.push({ kind: item.kind, key: item.key, doc: item.doc });
  }
  return out;
}

function baseVersionOf(state: StoreState, id: string): number {
  return state.dirty[id]?.baseVersion ?? state.server[id]?.version ?? 0;
}

/** Changes one item: `fn` gets the current doc (undefined for a new item) and returns the new one. */
export function editItem<T>(state: StoreState, kind: string, key: string, fn: (current: T | undefined) => T): StoreState {
  const id = itemId(kind, key);
  const doc = fn(getDoc<T>(state, kind, key));
  const rev = (state.dirty[id]?.rev ?? 0) + 1;
  const edit: DirtyEdit = { kind, key, baseVersion: baseVersionOf(state, id), doc, deleted: false, rev };
  return { ...state, dirty: { ...state.dirty, [id]: edit } };
}

/** Deletes one item. An item the server never had just loses its local edit. */
export function removeItem(state: StoreState, kind: string, key: string): StoreState {
  const id = itemId(kind, key);
  const onServer = state.server[id];
  if (!onServer || onServer.deleted) {
    if (!state.dirty[id]) return state;
    const dirty = { ...state.dirty };
    delete dirty[id];
    return { ...state, dirty };
  }
  const rev = (state.dirty[id]?.rev ?? 0) + 1;
  const edit: DirtyEdit = { kind, key, baseVersion: baseVersionOf(state, id), deleted: true, rev };
  return { ...state, dirty: { ...state.dirty, [id]: edit } };
}

export function hasPendingChanges(state: StoreState): boolean {
  return Object.keys(state.dirty).length > 0;
}

/** The dirty edits as the request sends them. */
export function toChangeRequests(edits: DirtyEdit[]): ChangeRequest[] {
  return edits.map((e) =>
    e.deleted
      ? { kind: e.kind, key: e.key, base_version: e.baseVersion, deleted: true }
      : { kind: e.kind, key: e.key, base_version: e.baseVersion, doc: e.doc },
  );
}

/**
 * A save of `sent` succeeded with `written`. An edit that didn't change while
 * the save was in flight is now clean. One that did stays dirty, now based on
 * the version just written, so its next save doesn't conflict with ourselves.
 */
export function markSaved(state: StoreState, sent: DirtyEdit[], written: GmItem[]): StoreState {
  const next = mergeServerItems(state, written);
  const versions = new Map(written.map((w) => [itemId(w.kind, w.key), w.version]));
  const dirty = { ...next.dirty };
  for (const edit of sent) {
    const id = itemId(edit.kind, edit.key);
    const now = dirty[id];
    if (!now) continue;
    if (now.rev === edit.rev) delete dirty[id];
    else dirty[id] = { ...now, baseVersion: versions.get(id) ?? now.baseVersion };
  }
  return { ...next, dirty, saving: false, saveError: null };
}

/**
 * A save was refused because `conflicts` changed under us. Those items take
 * the server's copy, and our edits to them move to `lost`. Every other edit
 * stays dirty, to be sent again.
 */
export function applyConflicts(state: StoreState, conflicts: GmItem[]): StoreState {
  const server = { ...state.server };
  const dirty = { ...state.dirty };
  const lost = [...state.lost];
  for (const item of conflicts) {
    const id = itemId(item.kind, item.key);
    const have = server[id];
    if (item.version === 0) delete server[id];
    else if (!have || have.seq <= item.seq) server[id] = item;
    const mine = dirty[id];
    if (mine) {
      delete dirty[id];
      lost.push(mine);
    }
  }
  return { ...state, server, dirty, lost, saving: false, saveError: null };
}

/** "Use mine": puts a lost edit back, based on the server's current copy. */
export function reapplyLost(state: StoreState, edit: DirtyEdit): StoreState {
  const id = itemId(edit.kind, edit.key);
  const lost = state.lost.filter((l) => l !== edit);
  const base = { ...state, lost };
  const redo: DirtyEdit = { ...edit, baseVersion: state.server[id]?.version ?? 0, rev: (state.dirty[id]?.rev ?? edit.rev) + 1 };
  if (redo.deleted && !state.server[id]) return base;
  return { ...base, dirty: { ...state.dirty, [id]: redo } };
}

export function dismissLost(state: StoreState): StoreState {
  return state.lost.length ? { ...state, lost: [] } : state;
}

// ------------------------------------------------------------------ assembly

const byId = <T extends { id: string }>(a: T, b: T) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

function asObject(doc: unknown): Record<string, unknown> {
  return doc && typeof doc === 'object' && !Array.isArray(doc) ? (doc as Record<string, unknown>) : {};
}

function withId<T>(item: LiveItem): T {
  return { ...asObject(item.doc), id: item.key } as T;
}

/**
 * Builds a phase's board from its items. The result doesn't depend on the
 * order of the items: lists are sorted (chunks by position, the rest by id).
 */
export function assembleBoard(items: LiveItem[]): BoardDoc {
  const board: BoardDoc = {
    chunks: [], cards: [], scenes: [], clusters: [],
    stances: {}, readDone: {}, ready: {}, covered: {}, dismissedFlags: {}, notes: '',
  };
  for (const item of items) {
    switch (item.kind) {
      case 'card': board.cards.push(withId<Card>(item)); break;
      case 'scene': board.scenes.push(sceneOf(item)); break;
      case 'chunk': board.chunks.push(withId<Chunk>(item)); break;
      case 'cluster': board.clusters.push(withId<Cluster>(item)); break;
      case 'stance': board.stances[item.key] = asObject(item.doc) as unknown as Stance; break;
      case 'flag': board.dismissedFlags[item.key] = true; break;
      case 'notes': board.notes = String(asObject(item.doc).text ?? ''); break;
      case 'progress': {
        const characterId = Number(item.key);
        const p = asObject(item.doc) as CharacterProgress;
        if (p.readDone) board.readDone[characterId] = true;
        if (p.ready) board.ready[characterId] = true;
        if (p.covered && Object.keys(p.covered).length) board.covered[characterId] = { ...p.covered };
        break;
      }
    }
  }
  board.chunks.sort((a, b) => a.position - b.position || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  board.cards.sort(byId);
  board.scenes.sort(byId);
  board.clusters.sort(byId);
  return board;
}

/** A scene, with its lists defaulted, so an older or hand-made item can't break the Scenes step. */
function sceneOf(item: LiveItem): Scene {
  const s = withId<Partial<Scene> & { id: string }>(item);
  const list = <T>(v: T[] | undefined): T[] => (Array.isArray(v) ? v : []);
  return {
    title: '', locationId: '', chunkId: '', conflict: false, ...s,
    participants: list(s.participants),
    effects: list(s.effects),
    moments: list(s.moments).map((m) => ({ ...m, text: m.text ?? '', readers: list(m.readers), ownText: m.ownText ?? {} })),
  };
}

/** A codex entry, with its lists defaulted so the checks never meet a missing one. */
function codexEntry(item: LiveItem): CodexEntry {
  const e = withId<Partial<CodexEntry> & { id: string }>(item);
  return {
    type: 'Other', name: '', notes: '', secret: false, ...e,
    aliases: Array.isArray(e.aliases) ? e.aliases : [],
    knownBy: Array.isArray(e.knownBy) ? e.knownBy : [],
    phases: Array.isArray(e.phases) ? e.phases : [],
  };
}

/** Builds a game's board settings from its items, with defaults for what isn't set. */
export function assembleSettings(items: LiveItem[]): GameBoardSettings {
  const settings: GameBoardSettings = {
    codex: [], names: {}, rewardTemplate: '', rewardGroups: [], scales: [], secondPerson: true,
  };
  for (const item of items) {
    const doc = asObject(item.doc);
    switch (item.kind) {
      case 'codex': settings.codex.push(codexEntry(item)); break;
      case 'names': if (Array.isArray(doc.names)) settings.names[Number(item.key)] = doc.names.map(String); break;
      case 'template': settings.rewardTemplate = String(doc.text ?? ''); break;
      case 'groups': if (Array.isArray(doc.groups)) settings.rewardGroups = doc.groups as GameBoardSettings['rewardGroups']; break;
      case 'scales': if (Array.isArray(doc.scales)) settings.scales = doc.scales as GameBoardSettings['scales']; break;
      case 'prefs': if (typeof doc.secondPerson === 'boolean') settings.secondPerson = doc.secondPerson; break;
    }
  }
  settings.codex.sort(byId);
  return settings;
}
