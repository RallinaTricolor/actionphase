/**
 * The reward block: the GM's own markdown template, filled in per character
 * from their reward lines and sheet.
 *
 * Tags:
 * - `{{lines g}}`: every line in section g, one after another.
 * - `{{if x}}…{{end}}`: shown only when x is a section with lines, a filled
 *   `{{text}}` slot, or a sheet value that isn't 0. Ifs can nest.
 * - `{{value|before|gain|max|label Tab/Entry[/Field]}}`: a sheet value after
 *   this phase, before it, the change, a track's max, or a scale's name.
 * - `{{text Slot}}`: a box the GM fills in per character.
 * - `{{changes Tab}}`: every change this phase makes on that tab.
 * - `{{name}}`: the character's name.
 *
 * Problems come back as sentences, for the template preview and the checks
 * before publishing. A tag that can't find what it names renders as "?".
 */

import type { SheetTab } from '@/types/characters';
import { findEntry, fieldByRef, formatNumber, lineText, mainNumberField, maxOf, numberOf, tabByRef, type SheetState, type SheetTabs, type TabDiff } from './rewards';
import type { GameBoardSettings, RewardLine } from './types';

export interface BlockContext {
  template: string;
  groups: GameBoardSettings['rewardGroups'];
  scales: GameBoardSettings['scales'];
  layout: readonly SheetTab[];
  /** The character's name, for {{name}}. */
  name: string;
  lines: readonly RewardLine[];
  texts: Record<string, string>;
  sheet: SheetState;
  diff: readonly TabDiff[];
}

export interface Block {
  text: string;
  problems: string[];
}

const IF_INNERMOST = /\{\{\s*if\s+([^}]+?)\s*\}\}((?:(?!\{\{\s*if\b)[\s\S])*?)\{\{\s*end\s*\}\}/;
const VALUE_TAGS = /\{\{\s*(lines|value|before|max|gain|label|text|name|changes)\b\s*([^}]*?)\s*\}\}/g;

/** The `{{text …}}` slot names in a template, in order. */
export function slotsOf(template: string): string[] {
  return [...new Set([...template.matchAll(/\{\{\s*text\s+([^}]+?)\s*\}\}/g)].map((m) => m[1]))];
}

/** The name for a number on a scale: the last step at or below it ("" below the first). */
export function scaleLabel(scales: GameBoardSettings['scales'], ref: string, n: number): string | undefined {
  const k = ref.trim().toLowerCase();
  const scale = scales.find((s) => s.name.trim().toLowerCase() === k);
  if (!scale) return undefined;
  let label = '';
  for (const step of [...scale.steps].sort((a, b) => a.min - b.min)) if (n >= step.min) label = step.label;
  return label;
}

type Resolved = { tab: SheetTab; entryName: string; field: string; err?: undefined } | { err: string; tab?: SheetTab };

/** A Tab/Entry[/Field] ref against the layout (the entry is looked up per sheet). */
function resolveRef(layout: readonly SheetTab[], ref: string): Resolved {
  const parts = ref.split('/').map((p) => p.trim());
  const tab = tabByRef(layout, parts[0] ?? '');
  if (!tab) return { err: `there’s no tab “${parts[0] ?? ''}”` };
  const entryName = parts.slice(1, parts.length > 2 ? -1 : undefined).join('/');
  if (!entryName) return { err: `name an entry, like ${tab.label}/Name`, tab };
  const field = parts.length > 2 ? (fieldByRef(tab, parts[parts.length - 1])?.key ?? parts[parts.length - 1]) : mainNumberField(tab);
  return { tab, entryName, field };
}

const entryIn = (tabs: SheetTabs, r: Extract<Resolved, { tab: SheetTab; entryName: string }>) => findEntry(tabs[r.tab.key] ?? [], r.entryName);

/** Edit distance, a swapped pair of letters counting as one edit, for "did you mean". */
function distance(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  return d[a.length][b.length];
}

function unknownIf(name: string, groups: BlockContext['groups'], slots: string[]): string {
  const names = [...groups.map((g) => g.key), ...slots];
  const lc = name.toLowerCase();
  const near = names.find((n) => n.toLowerCase() === lc) ?? names.find((n) => distance(n.toLowerCase(), lc) <= Math.max(1, Math.floor(n.length / 4)));
  if (near) return `{{if ${name}}}: nothing is called “${name}”. Did you mean {{if ${near}}}?`;
  const sections = groups.map((g) => g.key).join(', ');
  return `{{if ${name}}}: nothing is called “${name}”. Use a section${sections ? ` (${sections})` : ''}, a {{text}} slot, or a sheet value like Numbers/Rating.`;
}

/** Fills in the block for one character. */
export function renderBlock(ctx: BlockContext): Block {
  const problems: string[] = [];
  const slots = slotsOf(ctx.template);
  const withText = ctx.lines.filter((l) => l.text.trim());

  const value = (kind: string, ref: string): string => {
    const r = resolveRef(ctx.layout, ref);
    if (r.err !== undefined) {
      problems.push(`{{${kind} ${ref}}}: ${r.err}.`);
      return '?';
    }
    const after = entryIn(ctx.sheet.after, r);
    const entry = kind === 'before' ? entryIn(ctx.sheet.before, r) : after;
    if (!entry) {
      problems.push(`{{${kind} ${ref}}}: ${ctx.name} has no ${r.tab.label} entry “${r.entryName}”.`);
      return '?';
    }
    if (kind === 'max') {
      const max = maxOf(entry, r.field);
      if (max === undefined) {
        problems.push(`{{max ${ref}}}: it has no max.`);
        return '?';
      }
      return String(max);
    }
    if (kind === 'gain') {
      const d = numberOf(after, r.field) - numberOf(entryIn(ctx.sheet.before, r), r.field);
      return `${d >= 0 ? '+' : ''}${formatNumber(d)}`;
    }
    if (kind === 'label') {
      const label = scaleLabel(ctx.scales, ref, numberOf(entry, r.field));
      if (label === undefined) {
        problems.push(`{{label ${ref}}}: there’s no scale for it in Game setup.`);
        return '?';
      }
      return label;
    }
    const v = entry[r.field];
    if (v && typeof v === 'object' && 'value' in v) return formatNumber(Number((v as { value: unknown }).value) || 0);
    if (typeof v === 'number') return formatNumber(v);
    return v === undefined || v === null ? '' : String(v);
  };

  const truthy = (raw: string): boolean => {
    const x = raw.trim();
    if (ctx.groups.some((g) => g.key === x)) return withText.some((l) => l.group === x);
    if (slots.includes(x)) return !!ctx.texts[x]?.trim();
    const r = resolveRef(ctx.layout, x);
    if (r.err !== undefined) {
      if (!r.tab) problems.push(unknownIf(x, ctx.groups, slots));
      return false;
    }
    const entry = entryIn(ctx.sheet.after, r);
    return !!entry && numberOf(entry, r.field) !== 0;
  };

  let t = ctx.template;
  for (let guard = 0; IF_INNERMOST.test(t) && guard < 100; guard++) t = t.replace(IF_INNERMOST, (_, cond: string, body: string) => (truthy(cond) ? body : ''));
  for (const m of t.matchAll(/\{\{\s*(if|end)\b\s*([^}]*?)\s*\}\}/g)) {
    problems.push(m[1] === 'end' ? '{{end}} has no {{if …}} before it.' : !m[2] ? '{{if}} needs a name, like {{if bonus}}.' : `{{if ${m[2]}}} has no {{end}} after it.`);
  }
  t = t.replace(/\{\{\s*(if|end)\b[^}]*\}\}/g, '');

  t = t.replace(VALUE_TAGS, (_, kind: string, arg: string) => {
    if (kind === 'name') return ctx.name;
    if (kind === 'lines')
      return withText
        .filter((l) => l.group === arg)
        .map((l) => lineText(l, ctx.sheet.recs[l.id]))
        .join('\n\n');
    if (kind === 'text') return ctx.texts[arg] ?? '';
    if (kind === 'changes') {
      const tab = tabByRef(ctx.layout, arg);
      if (!tab) {
        problems.push(`{{changes ${arg}}}: there’s no tab “${arg}”.`);
        return '?';
      }
      const d = ctx.diff.find((x) => x.tab.key === tab.key);
      return d
        ? d.rows
            .map((r) => (r.kind === 'change' ? `${r.name}: ${r.fields.map((f) => `${f.before} → ${f.after}`).join(', ')}` : r.kind === 'add' ? `**${r.name}** (new)` : `~~${r.name}~~`))
            .join('\n\n')
        : '';
    }
    return value(kind, arg);
  });

  for (const m of t.matchAll(/\{\{\s*([^}]*?)\s*\}\}/g)) problems.push(`{{${m[1]}}} isn’t a tag the block knows.`);
  for (const g of new Set(withText.map((l) => l.group))) {
    if (!new RegExp(`\\{\\{\\s*lines\\s+${g.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\}\\}`).test(ctx.template)) {
      const label = ctx.groups.find((x) => x.key === g)?.label ?? g;
      problems.push(`Lines in “${label}” don’t appear: the template has no {{lines ${g}}}.`);
    }
  }

  return {
    text: t
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim(),
    problems: [...new Set(problems)],
  };
}

// ------------------------------------------------------------------ Game setup's text boxes

/** "key: Label" per line. A line with no label uses the key. */
export function parseGroups(text: string): GameBoardSettings['rewardGroups'] {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const i = l.indexOf(':');
      const key = (i >= 0 ? l.slice(0, i) : l).trim().replace(/\s+/g, '_');
      const label = (i >= 0 ? l.slice(i + 1) : '').trim();
      return { key, label: label || key };
    })
    .filter((g) => g.key);
}

/** "Tab/Entry: 0 Name, 5.5 Name" per line. */
export function parseScales(text: string): GameBoardSettings['scales'] {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .flatMap((l) => {
      const i = l.indexOf(':');
      if (i < 0) return [];
      const steps = l
        .slice(i + 1)
        .split(',')
        .map((s) => s.trim().match(/^(-?[\d.]+)\s+(.+)$/))
        .filter((m): m is RegExpMatchArray => !!m)
        .map((m) => ({ min: parseFloat(m[1]), label: m[2].trim() }));
      return [{ name: l.slice(0, i).trim(), steps }];
    });
}
