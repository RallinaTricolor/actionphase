/**
 * Reward lines and the character sheet.
 *
 * A character's rewards in a phase are a list of lines. Each line has text
 * for the reward block and, optionally, changes to their sheet. The block
 * (template.ts) and the draft sheet updates (draftUpdates below) both come
 * from the same lines, so they can't drift apart.
 *
 * The sheet maths runs on the live sheet: phases already published are on it.
 * A draft sheet update is a whole-tab snapshot (see useConflictingSheetDrafts),
 * so the board writes one per changed tab, all on one result.
 */

import { normalizeEntry, type RawSheetEntry, type SheetEntry, type TrackValue } from '@/lib/sheetEntries';
import { storageFieldName, type CharacterData, type CharacterSheetField, type SheetTab } from '@/types/characters';
import type { RewardItem, RewardLine, SheetOp } from './types';

/** A sheet as tab key → entries. */
export type SheetTabs = Record<string, SheetEntry[]>;

/** What one op did, for the block's {{entry}}/{{before}}/{{after}} and the checks. */
export interface OpRecord {
  op: SheetOp;
  tab: string;
  /** The entry's name as it is on the sheet (capitals fixed), else as typed. */
  entry: string;
  field?: string;
  before: string;
  after: string;
  /** It couldn't apply: nothing changed. */
  err?: string;
  /** It applied, but look again (over a max, below 0, a duplicate name). */
  warn?: string;
}

// ------------------------------------------------------------------ the sheet

const round2 = (n: number) => Math.round(n * 100) / 100;

/** A number as the block shows it: up to two decimals, no trailing zeros. */
export const formatNumber = (n: number) => (Number.isFinite(n) ? String(round2(n)) : '?');

/** Reads a character's tabs from their sheet rows. Rows without an id get a stable one. */
export function sheetTabsFrom(rows: CharacterData[] | undefined, layout: readonly SheetTab[]): SheetTabs {
  const tabs: SheetTabs = {};
  for (const tab of layout) {
    const row = rows?.find((d) => d.module_type === tab.key && d.field_name === storageFieldName(tab.key));
    let raw: unknown = [];
    try {
      raw = row?.field_value ? JSON.parse(row.field_value) : [];
    } catch {
      raw = [];
    }
    const list = Array.isArray(raw) ? (raw as RawSheetEntry[]) : [];
    tabs[tab.key] = list
      .filter((e) => e && typeof e === 'object')
      .map((e, i) => normalizeEntry(tab.key, { ...e, id: typeof e.id === 'string' && e.id ? e.id : `row-${i}` }));
  }
  return tabs;
}

const cloneTabs = (tabs: SheetTabs): SheetTabs => JSON.parse(JSON.stringify(tabs)) as SheetTabs;

/** A tab by key or name, ignoring case. */
export function tabByRef(layout: readonly SheetTab[], ref: string): SheetTab | undefined {
  const k = ref.trim().toLowerCase();
  return layout.find((t) => t.key.toLowerCase() === k || t.label.toLowerCase() === k);
}

const fieldOf = (tab: SheetTab, key: string): CharacterSheetField | undefined => tab.fields.find((f) => f.key === key);

/** A field by key or label, ignoring case. */
export function fieldByRef(tab: SheetTab, ref: string): CharacterSheetField | undefined {
  const k = ref.trim().toLowerCase();
  return tab.fields.find((f) => f.key.toLowerCase() === k || f.label.toLowerCase() === k);
}

/** The tab's number and track fields: what "add to a number" can change. */
export const numberFields = (tab: SheetTab) => tab.fields.filter((f) => f.type === 'number' || f.type === 'track');

/** The field an op or ref means when it names none: the tab's first number. */
export const mainNumberField = (tab: SheetTab) => numberFields(tab)[0]?.key ?? '';

/**
 * The tab a new sheet change starts on: the previous change's, so a run of
 * changes stays put; else the first tab with a track (XP, rating, gold), since
 * most rewards add to one; else the first with a number; else the first tab.
 */
export function defaultOpTab(layout: readonly SheetTab[], ops: readonly SheetOp[]): SheetTab | undefined {
  const previous = ops.length ? layout.find((t) => t.key === ops[ops.length - 1].tab) : undefined;
  return previous ?? layout.find((t) => t.fields.some((f) => f.type === 'track')) ?? layout.find((t) => numberFields(t).length) ?? layout[0];
}

/** An entry by name, ignoring case and spaces at the ends. */
export function findEntry(list: readonly SheetEntry[], name: string): SheetEntry | undefined {
  const n = name.trim().toLowerCase();
  return n ? list.find((e) => e.name.trim().toLowerCase() === n) : undefined;
}

const isTrack = (v: unknown): v is TrackValue => !!v && typeof v === 'object' && 'value' in (v as object);

/** A field's numeric value: a track's value, a number, or a number in text. Else 0. */
export function numberOf(entry: SheetEntry | undefined, field: string): number {
  const v = entry?.[field];
  if (isTrack(v)) return Number(v.value) || 0;
  if (typeof v === 'number') return v;
  const n = parseFloat(String(v ?? ''));
  return Number.isFinite(n) ? n : 0;
}

/** A track's maximum, if it has one. */
export function maxOf(entry: SheetEntry | undefined, field: string): number | undefined {
  const v = entry?.[field];
  return isTrack(v) && typeof v.max === 'number' ? v.max : undefined;
}

function setNumber(entry: SheetEntry, field: CharacterSheetField | undefined, key: string, n: number) {
  const v = entry[key];
  if (isTrack(v)) entry[key] = { ...v, value: round2(n) };
  else if (field?.type === 'track') entry[key] = { value: round2(n) };
  else entry[key] = round2(n);
}

/** A field's value as the block and the diff show it. */
function showValue(entry: SheetEntry | undefined, key: string): string {
  if (!entry) return '—';
  const v = entry[key];
  if (isTrack(v)) return formatNumber(Number(v.value) || 0) + (typeof v.max === 'number' ? `/${v.max}` : '');
  if (v === true) return 'yes';
  if (v === false) return 'no';
  return v === undefined || v === null || v === '' ? '—' : String(v);
}

/** A value typed for a field, as the sheet stores it. */
function typedValue(field: CharacterSheetField | undefined, value: unknown): unknown {
  if (field?.type === 'track') return { value: Number(value) || 0 };
  if (field?.type === 'number') return Number(value) || 0;
  if (field?.type === 'checkbox') return value === true || value === 'true';
  return value;
}

/**
 * Applies ops to a sheet, in order, changing `tabs`. An op that can't apply
 * changes nothing and says why. A new entry's id is `idFor(index of the op)`,
 * so working the same lines out twice gives the same sheet: the board compares
 * the result with the stored drafts to know when to resync.
 */
export function applyOps(layout: readonly SheetTab[], tabs: SheetTabs, ops: readonly SheetOp[], idFor: (i: number) => string): OpRecord[] {
  return ops.map((op, i) => {
    const rec: OpRecord = { op, tab: op.tab, entry: op.entry, before: '', after: '' };
    const tab = layout.find((t) => t.key === op.tab);
    if (!tab) return { ...rec, err: `There’s no sheet tab “${op.tab}”` };
    const list = (tabs[tab.key] = tabs[tab.key] ?? []);
    const name = op.entry.trim();

    if (op.act === 'add') {
      if (!name) return { ...rec, err: `A new ${tab.label} entry needs a name` };
      const entry: SheetEntry = { id: idFor(i), name };
      for (const [key, value] of Object.entries(op.fields ?? {})) {
        if (value === '' || value === null || value === undefined) continue;
        entry[key] = typedValue(fieldOf(tab, key), value);
      }
      list.push(entry);
      return { ...rec, entry: name, after: 'added', warn: findEntry(list.slice(0, -1), name) ? `${tab.label} already has an entry named ${name}` : undefined };
    }

    const entry = findEntry(list, name);
    if (!entry) return { ...rec, err: name ? `There’s no ${tab.label} entry named “${name}”` : `Pick which ${tab.label} entry` };
    rec.entry = entry.name;

    if (op.act === 'remove') {
      list.splice(list.indexOf(entry), 1);
      return { ...rec, after: 'removed' };
    }

    if (op.act === 'inc') {
      const key = op.field || mainNumberField(tab);
      if (!key) return { ...rec, err: `${tab.label} has no number to add to` };
      const before = numberOf(entry, key);
      setNumber(entry, fieldOf(tab, key), key, before + (Number(op.by) || 0));
      const after = numberOf(entry, key);
      const max = maxOf(entry, key);
      let warn: string | undefined;
      if (max !== undefined && after > max) warn = `${entry.name} would be over its max (${formatNumber(after)}/${max})`;
      if (after < 0) warn = `${entry.name} would go below 0`;
      return { ...rec, field: key, before: formatNumber(before), after: formatNumber(after), warn };
    }

    const field = fieldOf(tab, op.field);
    const before = showValue(entry, op.field);
    if (field?.type === 'track' || field?.type === 'number') setNumber(entry, field, op.field, Number(op.value) || 0);
    else entry[op.field] = typedValue(field, op.value);
    return { ...rec, field: op.field, before, after: showValue(entry, op.field) };
  });
}

/** A line's ops that touch the sheet: none for "Choose 1". */
const effectiveOps = (line: Pick<RewardLine, 'choose' | 'ops'>) => (line.choose ? [] : line.ops);

export interface SheetState {
  before: SheetTabs;
  after: SheetTabs;
  /** lineId → what each of its ops did. */
  recs: Record<string, OpRecord[]>;
}

/** A character's sheet before and after this phase's lines, applied in order. */
export function sheetFor(layout: readonly SheetTab[], live: SheetTabs, lines: readonly RewardLine[]): SheetState {
  const before = cloneTabs(live);
  for (const tab of layout) before[tab.key] = before[tab.key] ?? [];
  const after = cloneTabs(before);
  const recs: Record<string, OpRecord[]> = {};
  for (const line of lines) recs[line.id] = applyOps(layout, after, effectiveOps(line), (i) => `rw-${line.id}-${i}`);
  return { before, after, recs };
}

interface DiffField {
  key: string;
  label: string;
  before: string;
  after: string;
}
type DiffRow = { kind: 'add'; name: string } | { kind: 'remove'; name: string } | { kind: 'change'; name: string; fields: DiffField[] };
export interface TabDiff {
  tab: SheetTab;
  rows: DiffRow[];
  /** The tab's whole new value: what the draft sheet update stores. */
  value: SheetEntry[];
}

/** What changed on each tab, in layout order. Tabs with no change are left out. */
export function sheetDiff(layout: readonly SheetTab[], state: Pick<SheetState, 'before' | 'after'>): TabDiff[] {
  const out: TabDiff[] = [];
  for (const tab of layout) {
    const b = state.before[tab.key] ?? [];
    const a = state.after[tab.key] ?? [];
    const rows: DiffRow[] = [];
    for (const e of a) {
      const o = b.find((x) => x.id === e.id);
      if (!o) {
        rows.push({ kind: 'add', name: e.name });
        continue;
      }
      const keys = [...new Set([...Object.keys(o), ...Object.keys(e)])].filter((k) => k !== 'id' && stable(o[k]) !== stable(e[k]));
      if (keys.length) {
        rows.push({
          kind: 'change',
          name: e.name,
          fields: keys.map((k) => ({ key: k, label: k === 'name' ? 'Name' : fieldOf(tab, k)?.label ?? k, before: showValue(o, k), after: showValue(e, k) })),
        });
      }
    }
    for (const o of b) if (!a.some((e) => e.id === o.id)) rows.push({ kind: 'remove', name: o.name });
    if (rows.length) out.push({ tab, rows, value: a });
  }
  return out;
}

/** How many entries change, over every tab. */
export const diffCount = (diff: readonly TabDiff[]) => diff.reduce((n, d) => n + d.rows.length, 0);

export interface RewardSheetUpdate {
  module_type: string;
  field_name: string;
  /** The tab's whole new value, as JSON. */
  field_value: string;
}

/** The draft sheet updates a diff becomes: one whole-tab value per changed tab. */
export function draftUpdates(diff: readonly TabDiff[]): RewardSheetUpdate[] {
  return diff.map((d) => ({ module_type: d.tab.key, field_name: storageFieldName(d.tab.key), field_value: JSON.stringify(d.value) }));
}

/** Whether two sets of drafts store the same values (key order doesn't matter). */
export function sameUpdates(a: readonly RewardSheetUpdate[], b: readonly RewardSheetUpdate[]): boolean {
  const norm = (list: readonly RewardSheetUpdate[]) =>
    stable(
      [...list]
        .sort((x, y) => (x.module_type < y.module_type ? -1 : x.module_type > y.module_type ? 1 : 0))
        .map((u) => {
          let value: unknown = u.field_value;
          try {
            value = JSON.parse(u.field_value);
          } catch {
            // Compared as text.
          }
          return [u.module_type, u.field_name, value];
        }),
    );
  return norm(a) === norm(b);
}

// ------------------------------------------------------------------ list items and lines

/** JSON with sorted keys: key order can change on a round trip through the database. */
export function stable(o: unknown): string {
  if (Array.isArray(o)) return `[${o.map(stable).join(',')}]`;
  if (o && typeof o === 'object') {
    const rec = o as Record<string, unknown>;
    return `{${Object.keys(rec)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stable(rec[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(o ?? null);
}

/** What a given copy is compared on: section, text, sheet changes and Choose 1 (not the name). */
export const itemSig = (item: Pick<RewardItem, 'group' | 'text' | 'ops' | 'choose'>) => stable([item.group, item.text, item.ops, !!item.choose]);

/** A new line given from a list item: a copy, so one person's can change alone. */
export function lineFromItem(item: RewardItem, id: string, extra: Partial<RewardLine> = {}): RewardLine {
  return {
    id,
    itemId: item.id,
    itemSig: itemSig(item),
    group: item.group,
    text: item.text,
    ops: JSON.parse(JSON.stringify(item.ops)) as SheetOp[],
    choose: item.choose,
    ...extra,
  };
}

/** "Use the list's version": the line takes the item's current text and changes. */
export const syncLine = (line: RewardLine, item: RewardItem): RewardLine => ({ ...lineFromItem(item, line.id), quote: line.quote, sceneId: line.sceneId });

/** "Keep mine": the line stops being flagged until the item changes again. */
export const keepLine = (line: RewardLine, item: RewardItem): RewardLine => ({ ...line, itemSig: itemSig(item) });

/** The list item a line was given from, if it changed after the line was given or synced. */
export function driftedItem(line: RewardLine, items: readonly RewardItem[]): RewardItem | undefined {
  if (!line.itemId || !line.itemSig) return undefined;
  const item = items.find((i) => i.id === line.itemId);
  return item && itemSig(item) !== line.itemSig ? item : undefined;
}

/** One op, in a few words: "Numbers · Rating +1". */
function opSummary(layout: readonly SheetTab[], op: SheetOp): string {
  const tab = layout.find((t) => t.key === op.tab);
  const label = tab?.label ?? op.tab;
  const entry = op.entry.trim() || '?';
  if (op.act === 'add') return `${label}: + ${op.entry.trim() || '(name it)'}`;
  if (op.act === 'remove') return `${label}: − ${entry}`;
  if (op.act === 'inc') {
    const n = Number(op.by) || 0;
    return `${label} · ${entry} ${n >= 0 ? '+' : '−'}${formatNumber(Math.abs(n))}`;
  }
  const field = tab ? fieldOf(tab, op.field) : undefined;
  return `${label} · ${entry}: ${field?.label ?? op.field} = ${op.value}`;
}

/** What a line does to the sheet, in a few words, or that the player chooses. */
export function lineEffect(layout: readonly SheetTab[], line: Pick<RewardLine, 'choose' | 'ops'>): string {
  return line.choose ? 'Player chooses after publishing. No sheet change now.' : line.ops.map((op) => opSummary(layout, op)).join(', ');
}

/** A list item's ops leave an entry blank when it's picked per person ("Concept upgrade"). */
export const needsEntry = (ops: readonly SheetOp[]) => ops.some((op) => !op.entry.trim());

/** Line text with {{entry}}, {{before}} and {{after}} filled from its first op. */
export function lineText(line: Pick<RewardLine, 'text'>, recs: readonly OpRecord[] | undefined): string {
  const rec = recs?.[0];
  return line.text.replace(/\{\{\s*(entry|before|after)\s*\}\}/g, (_, k: 'entry' | 'before' | 'after') => (k === 'entry' ? rec?.entry || '?' : rec?.[k] || '?'));
}

// ------------------------------------------------------------------ sheet text

const plainText = (s: string) =>
  s
    .replace(/\[\[([^|\]]+)(?:\|[^\]]*)?\]\]/g, '$1')
    .replace(/\[color:[^\]]*\]|\[\/color\]/g, '')
    .replace(/[*_`#>~]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Just the description, for one-line previews of a sheet entry: the
 * Description column of a markdown table, else the text without markup.
 */
export function descriptionOnly(desc: string): string {
  const lines = desc
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length >= 3 && lines[0].includes('|') && /^[\s:|-]+$/.test(lines[1])) {
    const cells = (l: string) =>
      l
        .replace(/^\||\|$/g, '')
        .split('|')
        .map((c) => c.trim());
    const k = cells(lines[0]).findIndex((h) => /^desc/i.test(h));
    if (k >= 0)
      return lines
        .slice(2)
        .map((r) => plainText(cells(r)[k] ?? ''))
        .filter(Boolean)
        .join(' ');
  }
  return plainText(desc);
}
