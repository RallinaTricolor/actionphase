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

import { applyEntryEdit, createEntry, normalizeEntry, type EntryEdit, type RawSheetEntry, type SheetEntry, type TrackValue } from '@/lib/sheetEntries';
import { canonicalEntry, canonicalValue, fieldCodecOf, trackToDraft } from '@/lib/sheetFieldValues';
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

/**
 * The row as stored, kept on each entry read from the sheet. Not enumerable,
 * so it is never compared, spread or serialized: an op that changes an entry
 * builds a new object without it.
 */
const STORED = Symbol('stored row');

function withStored(entry: SheetEntry, raw: RawSheetEntry): SheetEntry {
  Object.defineProperty(entry, STORED, { value: raw });
  return entry;
}

/**
 * An entry as it goes into a draft. One no op changed goes back exactly as it
 * was stored (legacy shape, missing id and all), as the sheet editor writes
 * only the entry it edits; a changed or new entry goes in its current shape.
 */
function entryToStore(tabKey: string, entry: SheetEntry): RawSheetEntry {
  const raw = (entry as SheetEntry & { [STORED]?: RawSheetEntry })[STORED];
  return raw && stable(normalizeEntry(tabKey, { ...raw, id: entry.id })) === stable(entry) ? raw : entry;
}

/**
 * Reads a character's tabs from their sheet rows. Rows without an id get a
 * stable one for the maths; it is stored only if an op changes the entry.
 * Rows that aren't objects can't be shown or edited anywhere, and are dropped.
 */
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
      .map((e, i) => withStored(normalizeEntry(tab.key, { ...e, id: typeof e.id === 'string' && e.id ? e.id : `row-${i}` }), e));
  }
  return tabs;
}

/** A deep copy, keeping each entry's stored row. */
const cloneTabs = (tabs: SheetTabs): SheetTabs =>
  Object.fromEntries(
    Object.entries(tabs).map(([key, list]) => [
      key,
      list.map((e) => {
        const copy = JSON.parse(JSON.stringify(e)) as SheetEntry;
        const raw = (e as SheetEntry & { [STORED]?: RawSheetEntry })[STORED];
        return raw ? withStored(copy, raw) : copy;
      }),
    ]),
  );

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


/** A field's value as the block and the diff show it. */
function showValue(entry: SheetEntry | undefined, key: string): string {
  if (!entry) return '—';
  const v = entry[key];
  if (isTrack(v)) return formatNumber(Number(v.value) || 0) + (typeof v.max === 'number' ? `/${v.max}` : '');
  if (v === true) return 'yes';
  if (v === false) return 'no';
  return v === undefined || v === null || v === '' ? '—' : String(v);
}

/**
 * An op's value for a field, as the sheet editor's form would hold it: the
 * draft that field type's codec stores (`lib/sheetFieldValues.ts`). An op's
 * values are what the board's inputs typed (strings), or numbers it worked
 * out. A track keeps the current entry's maximum and display, so setting or
 * adding to it changes only its value.
 */
function opDraft(field: CharacterSheetField, value: unknown, current: unknown): unknown {
  if (field.type === 'track') {
    if (value !== null && typeof value === 'object') return trackToDraft(value);
    return { ...trackToDraft(current), value: value === undefined || value === null ? '' : String(value) };
  }
  if (field.type === 'checkbox') return value === true || value === 'true';
  return value === undefined || value === null ? '' : String(value);
}

/**
 * An op's value as the sheet stores it: through the same codec as the sheet
 * editor, so an entry the board writes is one the editor reads and saves back
 * unchanged. `undefined` means the key is left out (an empty field).
 */
function storedOpValue(field: CharacterSheetField, value: unknown, current?: unknown): unknown {
  const codec = fieldCodecOf(field);
  return codec ? codec.fromDraft(opDraft(field, value, current)) : value;
}

/** Why the board can't write a field, if it can't: one the schema lacks or this client doesn't know. */
function unwritable(tab: SheetTab, key: string): string | undefined {
  const field = fieldOf(tab, key);
  if (!field) return `${tab.label} has no field “${key}”`;
  if (!fieldCodecOf(field)) return `${tab.label}’s ${field.label} can’t be changed here`;
  return undefined;
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
      // Known fields go through their codec, as the editor's form would store
      // them; a key the schema has since dropped is kept as it is, as a loot
      // roll keeps it (lootDataToEdit).
      const values: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(op.fields ?? {})) {
        if (key === 'id' || key === 'name') continue;
        const field = fieldOf(tab, key);
        values[key] = field ? storedOpValue(field, value) : value === '' || value === null ? undefined : value;
      }
      list.push(createEntry(idFor(i), { name, values }));
      return { ...rec, entry: name, after: 'added', warn: findEntry(list.slice(0, -1), name) ? `${tab.label} already has an entry named ${name}` : undefined };
    }

    const entry = findEntry(list, name);
    if (!entry) return { ...rec, err: name ? `There’s no ${tab.label} entry named “${name}”` : `Pick which ${tab.label} entry` };
    rec.entry = entry.name;

    if (op.act === 'remove') {
      list.splice(list.indexOf(entry), 1);
      return { ...rec, after: 'removed' };
    }

    if (op.act === 'edit') {
      const values: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(op.values ?? {})) {
        if (key === 'id' || key === 'name') continue;
        const field = fieldOf(tab, key);
        if (field && !fieldCodecOf(field)) return { ...rec, err: unwritable(tab, key) };
        values[key] = value === null ? undefined : field ? storedOpValue(field, value, entry[key]) : value;
      }
      const rename = op.name?.trim();
      // Saving the sheet's form stores every field it shows, so the edited
      // entry is stored as a whole as the form would: a field the GM left
      // alone is normalised too, not just the ones the op names.
      const next = canonicalEntry(tab.fields, applyEntryEdit(entry, { name: rename || entry.name, values }));
      list[list.indexOf(entry)] = next;
      const clash = rename ? list.find((e) => e !== next && e.name.trim().toLowerCase() === rename.toLowerCase()) : undefined;
      return { ...rec, before: entry.name, after: next.name, warn: clash ? `${tab.label} already has an entry named ${clash.name}` : undefined };
    }

    if (op.act === 'inc') {
      const key = op.field || mainNumberField(tab);
      if (!key) return { ...rec, err: `${tab.label} has no number to add to` };
      const cant = unwritable(tab, key);
      if (cant) return { ...rec, err: cant };
      const before = numberOf(entry, key);
      const next = applyEntryEdit(entry, { name: entry.name, values: { [key]: storedOpValue(fieldOf(tab, key)!, round2(before + (Number(op.by) || 0)), entry[key]) } });
      list[list.indexOf(entry)] = next;
      const after = numberOf(next, key);
      const max = maxOf(next, key);
      let warn: string | undefined;
      if (max !== undefined && after > max) warn = `${entry.name} would be over its max (${formatNumber(after)}/${max})`;
      if (after < 0) warn = `${entry.name} would go below 0`;
      return { ...rec, field: key, before: formatNumber(before), after: formatNumber(after), warn };
    }

    const cant = unwritable(tab, op.field);
    if (cant) return { ...rec, err: cant };
    const before = showValue(entry, op.field);
    const next = applyEntryEdit(entry, { name: entry.name, values: { [op.field]: storedOpValue(fieldOf(tab, op.field)!, op.value, entry[op.field]) } });
    list[list.indexOf(entry)] = next;
    return { ...rec, field: op.field, before, after: showValue(next, op.field) };
  });
}

/**
 * Whether a line is a reward (in the block) or a sheet change (sheet only).
 * A line from before kinds existed is a sheet change when it has no text and
 * wasn't given from a list: the old "sheet only" line.
 */
export const lineKind = (line: Pick<RewardLine, 'kind' | 'text' | 'itemId' | 'choose'>): 'reward' | 'sheet' =>
  line.kind ?? (line.text.trim() || line.itemId || line.choose ? 'reward' : 'sheet');

/** A line's ops that touch the sheet: none for "Choose 1". */
const effectiveOps = (line: Pick<RewardLine, 'choose' | 'ops'>) => (line.choose ? [] : line.ops);

/**
 * One line worked out op by op, for its editor: the sheet before it (after
 * the character's earlier lines), before each of its ops, and after it. A line
 * not in `lines` (being made) comes after all of them. Gives the same ids as
 * `sheetFor`, so what the editor shows is what the drafts store.
 */
export interface LineSteps {
  before: SheetTabs;
  /** The sheet each op starts from: which entries it can pick, and what Edit entry opens. */
  steps: SheetTabs[];
  after: SheetTabs;
  recs: OpRecord[];
}

export function lineSteps(layout: readonly SheetTab[], live: SheetTabs, lines: readonly RewardLine[], line: RewardLine): LineSteps {
  const at = lines.findIndex((l) => l.id === line.id);
  const before = sheetFor(layout, live, at < 0 ? lines : lines.slice(0, at)).after;
  const after = cloneTabs(before);
  const steps: SheetTabs[] = [];
  const recs: OpRecord[] = [];
  effectiveOps(line).forEach((op, i) => {
    steps.push(cloneTabs(after));
    recs.push(...applyOps(layout, after, [op], () => `rw-${line.id}-${i}`));
  });
  return { before, steps, after, recs };
}

/**
 * An Edit entry op from what the sheet's entry form saved: only the fields it
 * changed, compared as the editor would store them, so a field the GM didn't
 * touch is left to whatever else changes it. `null` clears a field.
 */
export function editOpFrom(tab: SheetTab, entry: SheetEntry, edit: EntryEdit): Extract<SheetOp, { act: 'edit' }> {
  const values: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(edit.values)) {
    const field = fieldOf(tab, key);
    const was = field ? canonicalValue(field, entry[key]) : entry[key];
    if (stable(value) !== stable(was)) values[key] = value === undefined ? null : value;
  }
  const op: Extract<SheetOp, { act: 'edit' }> = { act: 'edit', tab: tab.key, entry: entry.name, values };
  if (edit.name.trim() && edit.name.trim() !== entry.name) op.name = edit.name.trim();
  return op;
}

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

export interface DiffField {
  key: string;
  label: string;
  before: string;
  after: string;
}

/** The fields that differ between two versions of an entry, the name first. */
export function fieldChanges(tab: SheetTab, before: SheetEntry, after: SheetEntry): DiffField[] {
  return [...new Set([...Object.keys(before), ...Object.keys(after)])]
    .filter((k) => k !== 'id' && stable(before[k]) !== stable(after[k]))
    .sort((a, b) => (a === 'name' ? -1 : b === 'name' ? 1 : 0))
    .map((k) => ({ key: k, label: k === 'name' ? 'Name' : fieldOf(tab, k)?.label ?? k, before: showValue(before, k), after: showValue(after, k) }));
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
      const fields = fieldChanges(tab, o, e);
      if (fields.length) rows.push({ kind: 'change', name: e.name, fields });
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
  return diff.map((d) => ({ module_type: d.tab.key, field_name: storageFieldName(d.tab.key), field_value: JSON.stringify(d.value.map((e) => entryToStore(d.tab.key, e))) }));
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
  if (op.act === 'edit') {
    const fields = Object.keys(op.values ?? {}).map((k) => (tab ? fieldOf(tab, k)?.label : undefined) ?? k);
    const rename = op.name?.trim() ? ` → ${op.name.trim()}` : '';
    return `${label} · ${entry}${rename}${fields.length ? `: ${fields.join(', ')}` : rename ? '' : ': no changes yet'}`;
  }
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
